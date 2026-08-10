//! Patch the live `NSApplication` class for Chromium `CrAppProtocol`.
//!
//! CEF (and Chromium) call `-[NSApp isHandlingSendEvent]` and
//! `-[NSApp setHandlingSendEvent:]` during the external message pump and other
//! event paths. Tauri/Tao's `NSApplication` subclass (`TaoApp`) does not
//! implement those selectors, so AppKit raises `NSInvalidArgumentException`
//! and the process dies (tab close via `close_browser`, native `<select>`, etc.).
//!
//! We cannot replace Tauri's application class. Instead, before
//! `cef::initialize`, add the two CrAppProtocol accessors on the shared
//! application's real class (TaoApp), not a dynamic KVO proxy such as
//! `NSKVONotifying_TaoApp`.
//!
//! We do NOT swizzle `sendEvent:` (CEF's preferred `CefScopedSendingEvent`
//! mirror). A Rust `Drop` guard across an ObjC exception boundary causes
//! "Rust cannot catch foreign exceptions" aborts when AppKit throws during
//! CEF browser creation. `isHandlingSendEvent` therefore returns false (the
//! flag is never set), which is a minor Chromium event-tracking inaccuracy
//! but not a crash. The accessors alone prevent the unrecognized-selector
//! crash.

use std::ffi::CString;
use std::fmt::Write as _;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use objc2::encode::{Encode, Encoding};
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
use objc2::{ffi, sel, ClassType, MainThreadMarker};
use objc2_app_kit::NSApplication;

static HANDLING_SEND_EVENT: AtomicBool = AtomicBool::new(false);
static INSTALL: OnceLock<Result<(), String>> = OnceLock::new();

/// Install CrAppProtocol accessors on the live shared application class.
///
/// Idempotent via `OnceLock`. Must run on the main thread before `cef::initialize`.
pub fn install() -> Result<(), String> {
  INSTALL
    .get_or_init(install_inner)
    .as_ref()
    .map(|_| ())
    .map_err(|error| error.clone())
}

fn install_inner() -> Result<(), String> {
  let mtm = MainThreadMarker::new()
    .ok_or_else(|| "CrAppProtocol patch requires the main thread".to_string())?;
  let app = NSApplication::sharedApplication(mtm);
  let start = shared_app_class(&app);
  let (primary, kvo) = resolve_patch_targets(start)?;

  // SAFETY: We only add well-known Chromium selectors on the live application
  // class before CEF is initialized. Type encodings match Bool.
  unsafe {
    add_accessor_methods(primary)?;
    if let Some(kvo_cls) = kvo {
      if !std::ptr::eq(kvo_cls, primary) {
        add_accessor_methods(kvo_cls)?;
      }
    }
  }

  log::info!(
    "patched NSApplication class {} for CrAppProtocol",
    primary.name().to_string_lossy()
  );
  if let Some(kvo_cls) = kvo {
    if !std::ptr::eq(kvo_cls, primary) {
      log::info!(
        "also patched KVO proxy class {} for CrAppProtocol",
        kvo_cls.name().to_string_lossy()
      );
    }
  }
  Ok(())
}

fn shared_app_class(app: &Retained<NSApplication>) -> &'static AnyClass {
  // SAFETY: Retained<NSApplication> is a valid Objective-C object pointer.
  let obj = unsafe { &*(Retained::as_ptr(app) as *const AnyObject) };
  obj.class()
}

/// Walk from the shared app's runtime class to the real TaoApp (or closest
/// non-KVO NSApplication subclass). Skip `NSKVONotifying_*` proxies.
fn resolve_patch_targets(
  start: &'static AnyClass,
) -> Result<(&'static AnyClass, Option<&'static AnyClass>), String> {
  let ns_app = NSApplication::class();
  let mut kvo: Option<&'static AnyClass> = None;
  let mut cls = start;

  loop {
    let name = cls.name().to_string_lossy();
    if name.starts_with("NSKVONotifying_") {
      if kvo.is_none() {
        kvo = Some(cls);
      }
      cls = cls.superclass().ok_or_else(|| {
        format!(
          "KVO proxy {} has no superclass for CrAppProtocol patch",
          name
        )
      })?;
      continue;
    }

    if inherits_nsapplication(cls, ns_app) {
      // First non-KVO class that is still under NSApplication (TaoApp preferred;
      // bare NSApplication only if that is all that remains).
      return Ok((cls, kvo));
    }

    cls = cls.superclass().ok_or_else(|| {
      format!(
        "no NSApplication subclass found above {} for CrAppProtocol patch",
        start.name().to_string_lossy()
      )
    })?;
  }
}

fn inherits_nsapplication(cls: &AnyClass, ns_app: &AnyClass) -> bool {
  let mut current = Some(cls);
  while let Some(c) = current {
    if std::ptr::eq(c, ns_app) {
      return true;
    }
    current = c.superclass();
  }
  false
}

fn method_type_encoding(ret: &Encoding, args: &[Encoding]) -> CString {
  let mut types = format!("{ret}{}{}", <*mut AnyObject>::ENCODING, Sel::ENCODING);
  for enc in args {
    write!(&mut types, "{enc}").expect("Encoding Display never fails");
  }
  CString::new(types).expect("Objective-C type encoding is valid CStr")
}

fn class_has_own_instance_method(cls: &AnyClass, name: Sel) -> bool {
  cls
    .instance_methods()
    .iter()
    .any(|method| method.name() == name)
}

unsafe fn add_accessor_methods(cls: &'static AnyClass) -> Result<(), String> {
  let cls_ptr = cls as *const AnyClass as *mut AnyClass;

  let is_sel = sel!(isHandlingSendEvent);
  if !class_has_own_instance_method(cls, is_sel) {
    let types = method_type_encoding(&Bool::ENCODING, &[]);
    let imp: Imp = std::mem::transmute(
      is_handling_send_event as unsafe extern "C-unwind" fn(*mut AnyObject, Sel) -> Bool,
    );
    let added = ffi::class_addMethod(cls_ptr, is_sel, imp, types.as_ptr());
    if !added.as_bool() {
      return Err(format!(
        "class_addMethod failed for isHandlingSendEvent on {}",
        cls.name().to_string_lossy()
      ));
    }
  }

  let set_sel = sel!(setHandlingSendEvent:);
  if !class_has_own_instance_method(cls, set_sel) {
    let types = method_type_encoding(&Encoding::Void, &[Bool::ENCODING]);
    let imp: Imp = std::mem::transmute(
      set_handling_send_event as unsafe extern "C-unwind" fn(*mut AnyObject, Sel, Bool),
    );
    let added = ffi::class_addMethod(cls_ptr, set_sel, imp, types.as_ptr());
    if !added.as_bool() {
      return Err(format!(
        "class_addMethod failed for setHandlingSendEvent: on {}",
        cls.name().to_string_lossy()
      ));
    }
  }

  Ok(())
}

unsafe extern "C-unwind" fn is_handling_send_event(
  _this: *mut AnyObject,
  _cmd: Sel,
) -> Bool {
  Bool::new(HANDLING_SEND_EVENT.load(Ordering::SeqCst))
}

unsafe extern "C-unwind" fn set_handling_send_event(
  _this: *mut AnyObject,
  _cmd: Sel,
  handling: Bool,
) {
  HANDLING_SEND_EVENT.store(handling.as_bool(), Ordering::SeqCst);
}
