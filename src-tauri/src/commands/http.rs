use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct HttpProxyRequest {
  pub url: String,
  pub method: String,
  pub headers: Option<std::collections::HashMap<String, String>>,
  pub body: Option<String>,
}

#[derive(serde::Serialize)]
pub struct HttpProxyResponse {
  pub status: u16,
  pub body: String,
}

#[tauri::command]
pub async fn http_proxy_request(request: HttpProxyRequest) -> Result<HttpProxyResponse, String> {
  let client = reqwest::Client::new();
  let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|e| e.to_string())?;

  let mut headers = HeaderMap::new();
  if let Some(map) = request.headers {
    for (key, value) in map {
      let name = HeaderName::from_bytes(key.as_bytes()).map_err(|e| e.to_string())?;
      let val = HeaderValue::from_str(&value).map_err(|e| e.to_string())?;
      headers.insert(name, val);
    }
  }

  let mut builder = client.request(method, &request.url).headers(headers);
  if let Some(body) = request.body {
    builder = builder.body(body);
  }

  let response = builder.send().await.map_err(|e| e.to_string())?;
  let status = response.status().as_u16();
  let body = response.text().await.map_err(|e| e.to_string())?;

  Ok(HttpProxyResponse { status, body })
}
