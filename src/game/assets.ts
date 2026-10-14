export function loadBinary(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      if (xhr.status === 0 || xhr.status === 200) resolve(xhr.response);
      else reject(new Error(`XHR ${xhr.status} for ${url}`));
    };
    xhr.onerror = () => reject(new Error(`XHR error for ${url}`));
    xhr.send();
  });
}
