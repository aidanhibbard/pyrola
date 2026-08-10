//! Pass mouse hits through transparent WKWebView holes to CEF behind.
//!
//! CEF paints behind Tauri's WKWebView. AppKit hit-testing ignores CSS
//! transparency, so WKWebView would eat every click over the hole. We override
//! the content view's `hitTest:` so points inside published passthrough rects
//! skip WKWebView and reach the CEF sibling underneath. Empty rects restore
//! normal WKWebView hit delivery (Vue overlays clear the list).

use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::{Mutex, OnceLock};

use objc2::runtime::{AnyClass, AnyObject, Imp, NSObjectProtocol, Sel};
use objc2::{ffi, msg_send, sel, ClassType};
use objc2_app_kit::NSView;
use objc2_foundation::NSPoint;
use objc2_web_kit::WKWebView;

use super::CefBounds;

static PASSTHROUGH_RECTS: OnceLock<Mutex<Vec<CefBounds>>> = OnceLock::new();
static ORIGINAL_HIT_TEST: AtomicPtr<()> = AtomicPtr::new(std::ptr::null_mut());
static HIT_TEST_INSTALLED: AtomicBool = AtomicBool::new(false);

fn passthrough_rects() -> &'static Mutex<Vec<CefBounds>> {
  PASSTHROUGH_RECTS.get_or_init(|| Mutex::new(Vec::new()))
}

fn passthrough_rects_empty() -> bool {
  passthrough_rects()
    .lock()
    .map(|guard| guard.is_empty())
    .unwrap_or(true)
}

/// Replace the active CSS-space passthrough rect list. Empty clears pass-through.
pub fn set_rects(rects: Vec<CefBounds>) {
  if let Ok(mut guard) = passthrough_rects().lock() {
    *guard = rects;
  }
}

/// Clear all passthrough rects (e.g. on browser destroy).
pub fn clear_rects() {
  set_rects(Vec::new());
}

/// Install `hitTest:` override on this window's content view class (once).
///
/// Must run on the main thread. Safe to call repeatedly.
pub fn install_on_content_view(content: *mut std::ffi::c_void) -> Result<(), String> {
  if content.is_null() {
    return Err("content view is null".into());
  }
  if HIT_TEST_INSTALLED.load(Ordering::SeqCst) {
    return Ok(());
  }

  // SAFETY: `content` is the window ns_view (WryWebViewParent / content view)
  // on the main thread; we only replace hitTest: on that live class.
  unsafe {
    let view = &*(content as *const AnyObject);
    let cls = view.class();
    swizzle_hit_test(cls)?;
  }

  HIT_TEST_INSTALLED.store(true, Ordering::SeqCst);
  log::info!("installed content-view hitTest passthrough for CEF holes");
  Ok(())
}

unsafe fn swizzle_hit_test(cls: &'static AnyClass) -> Result<(), String> {
  let hit_sel = sel!(hitTest:);
  let method = cls
    .instance_method(hit_sel)
    .ok_or_else(|| format!("class {} is missing hitTest:", cls.name().to_string_lossy()))?;

  let current = method.implementation();
  let ours: Imp = std::mem::transmute(
    patched_hit_test as unsafe extern "C-unwind" fn(*mut AnyObject, Sel, NSPoint) -> *mut AnyObject,
  );
  if original_imp_addr(current) == original_imp_addr(ours) {
    return Ok(());
  }

  let types = ffi::method_getTypeEncoding(method);
  if types.is_null() {
    return Err("hitTest: type encoding was null".into());
  }

  ORIGINAL_HIT_TEST.store(current as *mut (), Ordering::SeqCst);
  let cls_ptr = cls as *const AnyClass as *mut AnyClass;
  let _previous = ffi::class_replaceMethod(cls_ptr, hit_sel, ours, types);
  Ok(())
}

fn original_imp_addr(imp: Imp) -> usize {
  // SAFETY: Imp is a function pointer; address compare detects re-entrant install.
  unsafe { std::mem::transmute::<Imp, usize>(imp) }
}

fn point_in_rects(css_x: f64, css_y: f64) -> bool {
  let Ok(guard) = passthrough_rects().lock() else {
    return false;
  };
  guard.iter().any(|rect| {
    css_x >= rect.x
      && css_y >= rect.y
      && css_x < rect.x + rect.width
      && css_y < rect.y + rect.height
  })
}

/// Convert a content-view-local point (AppKit bottom-left) to CSS top-left space.
fn local_point_to_css(local: NSPoint, parent_h: f64) -> (f64, f64) {
  // Same y-flip as css_bounds_to_cef_rect / parent_view_height.
  (local.x, parent_h - local.y)
}

unsafe fn call_original_hit_test(
  this: *mut AnyObject,
  cmd: Sel,
  point: NSPoint,
) -> *mut AnyObject {
  let original = ORIGINAL_HIT_TEST.load(Ordering::SeqCst);
  if original.is_null() {
    return std::ptr::null_mut();
  }
  let original: unsafe extern "C-unwind" fn(*mut AnyObject, Sel, NSPoint) -> *mut AnyObject =
    std::mem::transmute(original);
  original(this, cmd, point)
}

unsafe extern "C-unwind" fn patched_hit_test(
  this: *mut AnyObject,
  cmd: Sel,
  point: NSPoint,
) -> *mut AnyObject {
  if this.is_null() {
    return std::ptr::null_mut();
  }

  // Fast path: no CSS holes published; never touch subviews from this IMP.
  if passthrough_rects_empty() {
    return call_original_hit_test(this, cmd, point);
  }

  match objc2::exception::catch(AssertUnwindSafe(|| {
    // SAFETY: `this` is the swizzled content NSView; AppKit may throw.
    unsafe { hole_path_hit_test(this, cmd, point) }
  })) {
    Ok(hit) => hit,
    Err(exc) => {
      match exc {
        Some(e) => log::warn!("hitTest passthrough threw ObjC exception: {e}; falling back"),
        None => log::warn!("hitTest passthrough threw nil ObjC exception; falling back"),
      }
      call_original_hit_test(this, cmd, point)
    }
  }
}

unsafe fn hole_path_hit_test(
  this: *mut AnyObject,
  cmd: Sel,
  point: NSPoint,
) -> *mut AnyObject {
  let content = &*(this as *const NSView);
  // hitTest: point is in the receiver's superview coordinate system.
  let local = content.convertPoint_fromView(point, content.superview().as_deref());
  let parent_h = content.bounds().size.height;
  let (css_x, css_y) = local_point_to_css(local, parent_h);

  if point_in_rects(css_x, css_y) {
    return hit_test_skipping_wkwebview(content, local);
  }

  call_original_hit_test(this, cmd, point)
}

/// Front-to-back hit test that ignores WKWebView so CEF behind the hole can win.
unsafe fn hit_test_skipping_wkwebview(content: &NSView, local: NSPoint) -> *mut AnyObject {
  let wk_class = WKWebView::class();
  let ordered: Vec<_> = content.subviews().iter().collect();
  // Subviews are back-to-front; walk front-to-back like NSView's hitTest:.
  for subview in ordered.into_iter().rev() {
    if subview.isKindOfClass(wk_class) {
      continue;
    }
    let hit: *mut AnyObject = msg_send![&*subview, hitTest: local];
    if !hit.is_null() {
      return hit;
    }
  }
  std::ptr::null_mut()
}
