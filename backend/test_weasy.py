from weasyprint import HTML
import markdown

html_str = """
<html>
<head>
<style>
@page { size: A4; margin: 2cm; }
body { font-family: Inter, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
.message { margin-bottom: 20px; }
.role { font-weight: bold; font-size: 12pt; margin-bottom: 5px; }
.human { text-align: left; }
.ai { text-align: left; }
pre { background: #f4f4f4; padding: 10px; border-radius: 5px; font-family: monospace; }
code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
.citations { font-style: italic; color: #888; font-size: 9pt; margin-top: 15px; }
</style>
</head>
<body>
<h1>Chat Transcript</h1>
<div class="message human">
<div class="role">User:</div>
<div>This is a test ✅ ✔️</div>
</div>
</body>
</html>
"""

try:
    pdf_bytes = HTML(string=html_str).write_pdf()
    with open('test_weasy.pdf', 'wb') as f:
        f.write(pdf_bytes)
    print("SUCCESS")
except Exception as e:
    print(f"FAIL: {e}")
