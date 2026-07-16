use std::collections::HashMap;

use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::Deserialize;
use tauri::ipc::Channel;

#[derive(Deserialize)]
pub struct HttpProxyRequest {
  pub url: String,
  pub method: String,
  pub headers: Option<HashMap<String, String>>,
  pub body: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyResponse {
  pub status: u16,
  pub body: String,
  pub headers: HashMap<String, String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum HttpProxyStreamEvent {
  Headers {
    status: u16,
    headers: HashMap<String, String>,
  },
  Chunk {
    bytes: Vec<u8>,
  },
  End,
  Error {
    message: String,
  },
}

fn build_headers(map: Option<HashMap<String, String>>) -> Result<HeaderMap, String> {
  let mut headers = HeaderMap::new();
  if let Some(map) = map {
    for (key, value) in map {
      let name = HeaderName::from_bytes(key.as_bytes()).map_err(|e| e.to_string())?;
      let val = HeaderValue::from_str(&value).map_err(|e| e.to_string())?;
      headers.insert(name, val);
    }
  }
  Ok(headers)
}

#[tauri::command]
pub async fn http_proxy_request(request: HttpProxyRequest) -> Result<HttpProxyResponse, String> {
  let client = reqwest::Client::new();
  let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|e| e.to_string())?;
  let headers = build_headers(request.headers)?;

  let mut builder = client.request(method, &request.url).headers(headers);
  if let Some(body) = request.body {
    builder = builder.body(body);
  }

  let response = builder.send().await.map_err(|e| e.to_string())?;
  let status = response.status().as_u16();

  let mut response_headers = HashMap::new();
  for (key, value) in response.headers().iter() {
    if let Ok(text) = value.to_str() {
      response_headers.insert(key.as_str().to_string(), text.to_string());
    }
  }

  let body = response.text().await.map_err(|e| e.to_string())?;

  Ok(HttpProxyResponse {
    status,
    body,
    headers: response_headers,
  })
}

#[tauri::command]
pub async fn http_proxy_stream(
  request: HttpProxyRequest,
  on_event: Channel<HttpProxyStreamEvent>,
) -> Result<(), String> {
  let client = reqwest::Client::new();
  let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|e| e.to_string())?;
  let headers = build_headers(request.headers)?;

  let mut builder = client.request(method, &request.url).headers(headers);
  if let Some(body) = request.body {
    builder = builder.body(body);
  }

  let response = builder.send().await.map_err(|e| e.to_string())?;
  let status = response.status().as_u16();

  let mut response_headers = HashMap::new();
  for (key, value) in response.headers().iter() {
    if let Ok(text) = value.to_str() {
      response_headers.insert(key.as_str().to_string(), text.to_string());
    }
  }

  on_event
    .send(HttpProxyStreamEvent::Headers {
      status,
      headers: response_headers,
    })
    .map_err(|e| e.to_string())?;

  let mut stream = response.bytes_stream();
  while let Some(chunk) = stream.next().await {
    match chunk {
      Ok(bytes) => {
        if bytes.is_empty() {
          continue;
        }
        on_event
          .send(HttpProxyStreamEvent::Chunk {
            bytes: bytes.to_vec(),
          })
          .map_err(|e| e.to_string())?;
      }
      Err(error) => {
        on_event
          .send(HttpProxyStreamEvent::Error {
            message: error.to_string(),
          })
          .map_err(|e| e.to_string())?;
        return Err(error.to_string());
      }
    }
  }

  on_event
    .send(HttpProxyStreamEvent::End)
    .map_err(|e| e.to_string())?;

  Ok(())
}
