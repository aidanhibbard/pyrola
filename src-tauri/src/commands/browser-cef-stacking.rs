//! macOS view stacking for CEF behind Tauri's WKWebView.
//!
//! CEF is created as a sibling NSView under the window content view. Without
//! reordering it is added last and paints over Vue chrome. We keep the CEF
//! view at the back so opaque UI stays above; CSS `background: transparent`
//! holes show CEF through the webview. Click pass-through lives in hit-test.
//!
//! Note: wry/Tao's content view (`TaoView`) does not implement
//! `sendSubviewToBack:`. Use `addSubview:positioned:relativeTo:` instead.

use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, Ordering};

use objc2::runtime::NSObjectProtocol;
use objc2::{msg_send, sel, ClassType};
use objc2_app_kit::{NSColor, NSView};
use objc2_web_kit::WKWebView;

/// `NSWindowOrderingMode::NSWindowBelow` (insert behind relative view / at back).
const NS_WINDOW_BELOW: isize = -1;

static WKWEBVIEW_BACKGROUND_CLEARED: AtomicBool = AtomicBool::new(false);

/// Move the CEF child NSView behind siblings (WKWebView) so Vue paints above.
///
/// Safe to call repeatedly after create and resize. ObjC exceptions are caught
/// so Rust does not abort with "cannot catch foreign exceptions".
pub fn send_cef_view_to_back(handle: cef::sys::cef_window_handle_t) {
  if handle.is_null() {
    return;
  }

  let result = objc2::exception::catch(AssertUnwindSafe(|| {
    // SAFETY: handle is a non-null CEF window NSView pointer on the main thread.
    unsafe {
      let view = &*(handle as *const NSView);
      let Some(superview) = view.superview() else {
        return;
      };

      // Prefer ordering below the WKWebView sibling when present. nil relativeTo
      // with NSWindowBelow inserts at the back of the subview list.
      let relative = find_wkwebview_sibling_ptr(&superview, view);
      let _: () = msg_send![
        &*superview,
        addSubview: view,
        positioned: NS_WINDOW_BELOW,
        relativeTo: relative
      ];
    }
  }));

  if let Err(exc) = result {
    match exc {
      Some(e) => log::warn!("CEF view reorder threw ObjC exception: {e}"),
      None => log::warn!("CEF view reorder threw nil ObjC exception"),
    }
  }
}

/// Clear Tauri WKWebView's opaque fill once so CEF shows through CSS holes.
///
/// Idempotent. Retries later if the WKWebView is not under `parent` yet.
pub fn clear_wkwebview_background(parent: cef::sys::cef_window_handle_t) {
  if WKWEBVIEW_BACKGROUND_CLEARED.load(Ordering::SeqCst) {
    return;
  }
  if parent.is_null() {
    return;
  }

  let cleared = match objc2::exception::catch(AssertUnwindSafe(|| {
    // SAFETY: parent is the window content NSView on the main thread.
    unsafe { clear_wkwebview_in_content_view(parent) }
  })) {
    Ok(cleared) => cleared,
    Err(exc) => {
      match exc {
        Some(e) => log::warn!("clear WKWebView background threw ObjC exception: {e}"),
        None => log::warn!("clear WKWebView background threw nil ObjC exception"),
      }
      false
    }
  };

  if cleared {
    WKWEBVIEW_BACKGROUND_CLEARED.store(true, Ordering::SeqCst);
    log::info!("cleared WKWebView background for CEF-behind stacking");
  }
}

/// Find a WKWebView under `parent` that is not `exclude` (the CEF view).
/// Returns a raw pointer suitable for `relativeTo:` (null if none).
unsafe fn find_wkwebview_sibling_ptr(
  parent: &NSView,
  exclude: &NSView,
) -> *const NSView {
  let wk_class = WKWebView::class();
  let exclude_ptr = exclude as *const NSView;
  for subview in parent.subviews().iter() {
    let sub_ptr = &*subview as *const NSView;
    if sub_ptr == exclude_ptr {
      continue;
    }
    if subview.isKindOfClass(wk_class) {
      return sub_ptr;
    }
  }
  std::ptr::null()
}

unsafe fn clear_wkwebview_in_content_view(parent: cef::sys::cef_window_handle_t) -> bool {
  let content = &*(parent as *const NSView);
  let subviews = content.subviews();
  let wk_class = WKWebView::class();

  for subview in subviews.iter() {
    if !subview.isKindOfClass(wk_class) {
      continue;
    }
    // SAFETY: isKindOfClass confirmed WKWebView; UI work is on the main thread.
    let webview = &*(&*subview as *const NSView as *const WKWebView);
    clear_one_wkwebview(webview);
    return true;
  }
  false
}

unsafe fn clear_one_wkwebview(webview: &WKWebView) {
  // Private API when present: default WKWebView draws an opaque page background.
  // Prefer the selector over KVC so a missing key does not throw NSUnknownKeyException
  // through a Rust frame (foreign exceptions abort).
  let draws_sel = sel!(setDrawsBackground:);
  if webview.respondsToSelector(draws_sel) {
    let _: () = msg_send![webview, setDrawsBackground: false];
  }

  // Public API: transparent under-page fill when HTML/CSS leaves holes.
  webview.setUnderPageBackgroundColor(Some(&*NSColor::clearColor()));
}
