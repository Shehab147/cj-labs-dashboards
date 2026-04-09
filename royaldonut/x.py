import webview
import threading
import time
import os
import ssl
import urllib3
import subprocess
import shutil
import tempfile
import urllib.request

# Disable SSL warnings
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Global window reference for API functions
_window = None

def _open_file(path):
    """Open file with default application across OSes."""
    if os.name == 'nt':
        os.startfile(path)
        return

    if shutil.which('open'):
        subprocess.run(['open', path], check=True)
        return

    subprocess.run(['xdg-open', path], check=True)

def print_html_direct(html_content):
    """Print HTML content directly to the default printer"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8') as tmp_file:
            tmp_file.write(html_content)
            tmp_path = tmp_file.name

        pdf_path = tmp_path.replace('.html', '.pdf')

        # Convert HTML to PDF and print directly
        subprocess.run(
            [
                'wkhtmltopdf', '--page-size', 'A4', '--margin-top', '5mm',
                '--margin-bottom', '5mm', '--margin-left', '5mm',
                '--margin-right', '5mm', tmp_path, pdf_path
            ],
            check=True,
            capture_output=True
        )
        subprocess.run(['lpr', pdf_path], check=True)
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def print_page():
    """Trigger browser print dialog"""
    if _window:
        _window.evaluate_js('window.print()')

def print_html(html_content):
    """Print HTML content by creating a temp file and opening it"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8') as tmp_file:
            tmp_file.write(html_content)
            tmp_path = tmp_file.name
        _open_file(tmp_path)
        return {'success': True, 'path': tmp_path}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def download_and_print_pdf(url):
    """Download PDF from URL and open it for printing"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx) as response:
                tmp_file.write(response.read())
            tmp_path = tmp_file.name
        _open_file(tmp_path)
        return {'success': True, 'path': tmp_path}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def open_pdf(url):
    """Open PDF URL in default PDF viewer"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx) as response:
                tmp_file.write(response.read())
            tmp_path = tmp_file.name
        _open_file(tmp_path)
        return {'success': True, 'path': tmp_path}
    except Exception as e:
        return {'success': False, 'error': str(e)}


LOADING_HTML = """
    <style>
        body {
            background-color: #000;
            color: white;
            font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
        }
        .main-container {
            width: 100%;
            height: 90vh;
            display: flex;
            display: -webkit-flex;
            align-items: center;
            -webkit-align-items: center;
            justify-content: center;
            -webkit-justify-content: center;
            overflow: hidden;
        }
        .loader {
          font-size: 10px;
          margin: 50px auto;
          text-indent: -9999em;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: #ffffff;
          background: -moz-linear-gradient(left, #ffffff 10%, rgba(255, 255, 255, 0) 42%);
          background: -webkit-linear-gradient(left, #ffffff 10%, rgba(255, 255, 255, 0) 42%);
          background: linear-gradient(to right, #ffffff 10%, rgba(255, 255, 255, 0) 42%);
          position: relative;
          -webkit-animation: load3 1.4s infinite linear;
          animation: load3 1.4s infinite linear;
          -webkit-transform: translateZ(0);
          -ms-transform: translateZ(0);
          transform: translateZ(0);
        }
        .loader:before {
          width: 50%; height: 50%; background: #ffffff;
          border-radius: 100% 0 0 0;
          position: absolute; top: 0; left: 0; content: '';
        }
        .loader:after {
          background: #333; width: 75%; height: 75%;
          border-radius: 50%; content: '';
          margin: auto; position: absolute;
          top: 0; left: 0; bottom: 0; right: 0;
        }
        @-webkit-keyframes load3 {
          0%   { -webkit-transform: rotate(0deg);   transform: rotate(0deg);   }
          100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); }
        }
        @keyframes load3 {
          0%   { -webkit-transform: rotate(0deg);   transform: rotate(0deg);   }
          100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); }
        }
    </style>
    <body>
      <div class="main-container">
          <div class="loader">Loading...</div>
      </div>
    </body>
"""

TARGET_URL = "https://royaldonut.systems.labs.cloudjet.org/ar/login?redirectTo=/ar/pos"

def load_after_ready(window):
    time.sleep(0.5)
    window.load_url(TARGET_URL)

if __name__ == '__main__':
    window = webview.create_window(
        title='RoyalDonuts',
        html=LOADING_HTML,
        width=1920,
        height=1080,
        resizable=True,
        background_color='#333333'
    )

    _window = window

    window.expose(print_html_direct)
    window.expose(print_page)
    window.expose(download_and_print_pdf)
    window.expose(open_pdf)

    threading.Thread(target=load_after_ready, args=(window,), daemon=True).start()
    webview.start()
