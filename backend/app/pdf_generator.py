import markdown
import re
from langchain_core.messages import AnyMessage

try:
    from weasyprint import HTML as _WeasyHTML
    _WEASYPRINT_AVAILABLE = True
except OSError:
    _WEASYPRINT_AVAILABLE = False
    _WeasyHTML = None

def generate_pdf_from_messages(thread_name: str, messages: list[AnyMessage]) -> bytes:
    """
    Generates a PDF byte string from a list of thread messages.
    """
    
    # Weasyprint handles unicode and emojis natively.
    css_str = """
    @page { size: A4; margin: 2cm; }
    body { font-family: Inter, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; color: #1E293B; }
    .title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 20px; }
    .message { margin-bottom: 25px; }
    .human { text-align: right; }
    .ai { text-align: left; }
    .role { font-weight: bold; font-size: 11pt; margin-bottom: 4px; }
    .content p { margin: 0 0 10px 0; }
    .content ul, .content ol { margin: 0 0 10px 0; padding-left: 20px; }
    .content li { margin-bottom: 4px; }
    .citations { font-style: italic; color: #888888; font-size: 8pt; margin-top: 10px; }
    pre { background: #F1F5F9; padding: 10px; border-radius: 5px; font-family: monospace; overflow-x: auto; }
    code { background: #F1F5F9; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
    .no-response { color: #666666; font-style: italic; }
    """

    html_parts = [
        "<html><head><style>",
        css_str,
        "</style></head><body>",
        f'<div class="title">Chat Transcript: {thread_name}</div>'
    ]
    
    for i, msg in enumerate(messages):
        if msg.type == "human":
            role_label = "User"
            role_class = "human"
        elif msg.type == "ai":
            role_label = "Surtn AI"
            role_class = "ai"
        else:
            continue
            
        content = msg.content
        if not isinstance(content, str):
            content = str(content)

        if not content.strip():
            continue
            
        # Strip redundant AI/User role strings off the generated response
        prefixes_to_strip = [f"{role_label.lower()}:", "ai:", "user:", "agent:", "surtn ai:"]
        changed = True
        while changed:
            changed = False
            content_stripped = content.strip()
            content_lower = content_stripped.lower()
            for prefix in prefixes_to_strip:
                if content_lower.startswith(prefix):
                    content = content_stripped[len(prefix):].strip()
                    content_lower = content.lower()
                    changed = True
                    break
        
        # Extract citations
        citations = []
        def extract_citation(match):
            citations.append(match.group(1))
            return ''
            
        content = re.sub(r'(\[Source:.*?\])\.? *', extract_citation, content, flags=re.IGNORECASE)
        
        unique_citations = []
        for c in citations:
            if c not in unique_citations:
                unique_citations.append(c)
                
        # Markdown to HTML
        html_msg = markdown.markdown(content)
        
        # Build block
        block = f'''
        <div class="message {role_class}">
            <div class="role">{role_label}:</div>
            <div class="content">{html_msg}</div>
        '''
        
        if unique_citations:
            sources_html = "<br/>".join([c for c in unique_citations])
            block += f'<div class="citations">{sources_html}</div>'
            
        block += "</div>"
        html_parts.append(block)

        # Handle unanswered human messages
        if msg.type == "human":
            next_visible = None
            for next_msg in messages[i+1:]:
                if next_msg.type in ("human", "ai"):
                    next_content = str(next_msg.content) if not isinstance(next_msg.content, str) else next_msg.content
                    if next_content.strip():
                        next_visible = next_msg
                        break
            
            if next_visible and next_visible.type == "human":
                html_parts.append('''
                <div class="message ai">
                    <div class="role">Surtn AI:</div>
                    <div class="content no-response">No response generated</div>
                </div>
                ''')

    html_parts.append("</body></html>")
    full_html = "".join(html_parts)
    
    # Generate PDF via WeasyPrint
    if not _WEASYPRINT_AVAILABLE:
        raise RuntimeError("WeasyPrint is not available on this system (missing GTK/GLib libraries). PDF export is disabled.")
    pdf_bytes = _WeasyHTML(string=full_html).write_pdf()
    return pdf_bytes
