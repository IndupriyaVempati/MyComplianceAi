from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)
try:
    print(hasattr(pdf, 'set_emoji_font'))
    print(hasattr(pdf, 'add_font'))
except Exception as e:
    print(e)
