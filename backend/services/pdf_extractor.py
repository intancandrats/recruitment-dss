import pdfplumber
import io
import re

def extract_text_from_bytes(file_bytes: bytes) -> str:
    """
    Mengekstrak semua teks dari file PDF dalam bentuk bytes.

    Parameter:
        file_bytes: isi file PDF sebagai bytes (dari upload)

    Return:
        String teks hasil ekstraksi, sudah dibersihkan
    """

    extracted_pages = []

    # Bungkus bytes dalam objek file virtual (tidak perlu simpan ke disk)
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:

        for page_number, page in enumerate(pdf.pages, start=1):

            # Ekstrak teks dari halaman ini
            page_text = page.extract_text()

            # Lewati halaman kosong
            if page_text and page_text.strip():
                extracted_pages.append(page_text)

    if not extracted_pages:
        return ""

    # Gabungkan semua halaman
    full_text = "\n\n".join(extracted_pages)

    # Bersihkan teks
    full_text = clean_text(full_text)

    return full_text


def clean_text(text: str) -> str:
    """
    Membersihkan teks hasil ekstraksi dari karakter-karakter noise.
    """

    # Hapus karakter non-printable kecuali newline dan spasi
    text = re.sub(r'[^\x20-\x7E\n\t\u00C0-\u024F]', ' ', text)

    # Ganti multiple spasi berturut-turut dengan 1 spasi
    text = re.sub(r'[ \t]+', ' ', text)

    # Ganti lebih dari 2 baris kosong berturut-turut dengan 2 baris
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Bersihkan spasi di awal/akhir tiap baris
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)

    return text.strip()


def extract_text_from_path(file_path: str) -> str:
    """
    Versi alternatif: ekstrak dari path file (untuk testing lokal).
    """
    with open(file_path, 'rb') as f:
        file_bytes = f.read()
    return extract_text_from_bytes(file_bytes)