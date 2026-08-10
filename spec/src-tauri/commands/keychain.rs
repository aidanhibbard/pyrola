use app_lib::commands::keychain::{
  merge_legacy_into_map, parse_vault, require_pyrola_key, serialize_vault, VaultMap, VAULT_ACCOUNT,
};

#[test]
fn parse_vault_empty_payload() {
  let map = parse_vault("").expect("empty vault");
  assert!(map.is_empty());
  let map = parse_vault("   ").expect("whitespace vault");
  assert!(map.is_empty());
}

#[test]
fn parse_vault_round_trip() {
  let mut expected = VaultMap::new();
  expected.insert(
    "pyrola:provider:openai".to_string(),
    "sk-test".to_string(),
  );
  expected.insert(
    "pyrola:mcp:github:input:token".to_string(),
    "ghp_test".to_string(),
  );
  let payload = serialize_vault(&expected).expect("serialize");
  let parsed = parse_vault(&payload).expect("parse");
  assert_eq!(parsed, expected);
}

#[test]
fn parse_vault_rejects_vault_account_key() {
  let payload = format!(r#"{{"{VAULT_ACCOUNT}":"nope"}}"#);
  let err = parse_vault(&payload).expect_err("vault account key");
  assert!(err.contains("must not contain the vault account key"));
}

#[test]
fn parse_vault_rejects_invalid_json() {
  let err = parse_vault("{not-json").expect_err("invalid json");
  assert!(err.contains("Invalid keychain vault JSON"));
}

#[test]
fn require_pyrola_key_rejects_prefix_and_vault_account() {
  assert!(require_pyrola_key("other:key").is_err());
  assert!(require_pyrola_key(VAULT_ACCOUNT).is_err());
  assert!(require_pyrola_key("pyrola:provider:openai").is_ok());
}

#[test]
fn merge_legacy_prefers_existing_vault_value() {
  let mut map = VaultMap::new();
  map.insert(
    "pyrola:provider:openai".to_string(),
    "vault-value".to_string(),
  );
  let merged = merge_legacy_into_map(
    &mut map,
    "pyrola:provider:openai",
    Some("legacy-value".to_string()),
  );
  assert_eq!(merged.as_deref(), Some("vault-value"));
  assert_eq!(map.get("pyrola:provider:openai").map(String::as_str), Some("vault-value"));
}

#[test]
fn merge_legacy_inserts_when_missing() {
  let mut map = VaultMap::new();
  let merged = merge_legacy_into_map(
    &mut map,
    "pyrola:provider:anthropic",
    Some("sk-legacy".to_string()),
  );
  assert_eq!(merged.as_deref(), Some("sk-legacy"));
  assert_eq!(
    map.get("pyrola:provider:anthropic").map(String::as_str),
    Some("sk-legacy")
  );
}

#[test]
fn merge_legacy_returns_none_when_absent() {
  let mut map = VaultMap::new();
  let merged = merge_legacy_into_map(&mut map, "pyrola:provider:missing", None);
  assert!(merged.is_none());
  assert!(map.is_empty());
}
