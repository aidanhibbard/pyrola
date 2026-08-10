use app_lib::commands::codegraph::validate_action;

#[test]
fn validate_action_allows_init_and_index() {
  assert!(validate_action("init").is_ok());
  assert!(validate_action("INIT").is_ok());
  assert!(validate_action("index").is_ok());
  assert!(validate_action("INDEX").is_ok());
  assert!(validate_action("serve").is_err());
  assert!(validate_action("sync").is_err());
}
