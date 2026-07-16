pub mod config;
pub mod http;
pub mod keychain;
pub mod mcp;
pub mod paths;
pub mod registry;
pub mod shell;
pub mod watch;

pub use config::{
  config_exists, read_json_file, read_mcp_config, read_settings, write_json_file, write_mcp_config,
  write_settings,
};
pub use http::http_proxy_request;
pub use keychain::{delete_secret, get_secret, set_secret};
pub use mcp::{mcp_list_tools, mcp_logout, mcp_refresh, mcp_start, mcp_status, mcp_stop};
pub use paths::{
  get_default_workspace_root, get_pyrola_dir, get_user_pyrola_dir, has_project_pyrola,
  list_project_files, list_pyrola_files,
};
pub use registry::{
  get_active_project, registry_add_project, registry_list_projects, registry_remove_project,
  registry_set_active_project,
};
pub use shell::reveal_in_folder;
pub use watch::{watch_pyrola_paths, WatchState};
