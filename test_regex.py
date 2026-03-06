import urllib.request
import re

url = 'https://internshala.com/internships/computer-science-internship'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

req = urllib.request.Request(url, headers=headers)
html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')

cards = html.split('class="individual_internship"')
if len(cards) < 2:
    cards = html.split('id="individual_internship_')

for i, card in enumerate(cards[1:5]):
    print(f"--- CARD {i} ---")
    stipend_chunk = re.search(r'(?i)STIPEND\s*-->[\s\S]{0,350}', card)
    if stipend_chunk:
        stip = stipend_chunk.group(0).encode('ascii', 'ignore').decode()
        print(stip)
