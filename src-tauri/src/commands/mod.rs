pub mod chat;
pub mod config;
pub mod fs;
pub mod git;
pub mod glob;
pub mod grep;
pub mod http;
pub mod keychain;
pub mod lsp;
pub mod mcp;
pub mod paths;
pub mod registry;
pub mod shell;
pub mod watch;
pub use chat::{
  append_chat_line, create_chat, delete_chat, fork_chat, list_chats, list_pinned_chats, pin_chat,
  read_chat_meta, read_chat_messages, update_chat_meta,
};
pub use config::{
  config_exists, read_json_file, read_mcp_config, read_settings, write_json_file, write_mcp_config,
  write_settings,
};
pub use fs::{
  fs_apply_patch, fs_edit_file, fs_list_dir, fs_list_dir_tree, fs_read_file, fs_stage_preview,
  fs_stat, fs_write_file,
};
pub use git::{
  git_checkout_branch, git_diff, git_list_branches, git_log, git_repo_info, git_status,
};
pub use glob::workspace_glob;
pub use grep::workspace_grep;
pub use http::{http_proxy_request, http_proxy_stream};
pub use keychain::{delete_secret, get_secret, set_secret};
pub use lsp::{lsp_ensure_server, lsp_request, lsp_status, lsp_stop_server};
pub use mcp::{
  mcp_call_tool, mcp_list_tools, mcp_logout, mcp_refresh, mcp_start, mcp_status, mcp_stop,
};
pub use paths::{
  get_default_workspace_root, get_pyrola_dir, get_user_pyrola_dir, has_project_pyrola,
  list_project_files, list_pyrola_files,
};
pub use registry::{
  get_active_project, registry_add_project, registry_list_projects, registry_remove_project,
  registry_set_active_project, registry_update_project_root,
};
pub use shell::{
  reveal_in_folder, shell_kill_pty, shell_resize_pty, shell_run_command, shell_spawn_pty,
  shell_write_pty,
};
pub use watch::{watch_pyrola_paths, WatchState};
