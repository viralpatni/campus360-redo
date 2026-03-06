import urllib.request
import re
import json
import time
import os

urls = [
    'https://internshala.com/internships/computer-science-internship',
    'https://internshala.com/internships/electronics-internship',
    'https://internshala.com/internships/mechanical-engineering-internship',
    'https://internshala.com/internships/data-science-internship',
    'https://internshala.com/internships/web-development-internship'
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
}

all_internships = []
seen_links = set()

for url in urls:
    print(f"Scraping {url}...")
    req = urllib.request.Request(url, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=10)
        html = response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"  -> Failed: {e}")
        continue
    
    # Split by cards
    cards = html.split('class="individual_internship"')
    if len(cards) < 2:
        cards = html.split('id="individual_internship_')
        
    for card in cards[1:]:
        # link and title
        match = re.search(r'class="job-title-href"[^>]*href="([^"]+)"[^>]*>(?:<[^>]+>\s*)*([^<]+)</', card)
        if not match: continue
        link = match.group(1).strip()
        if link.startswith('/'): link = "https://internshala.com" + link
        title = match.group(2).strip()
        
        # company
        comp_m = re.search(r'class="link_display_like_text"[^>]*>([^<]+)<', card)
        company = comp_m.group(1).strip() if comp_m else "Unknown"
        
        # location
        loc_m = re.findall(r'class="location_link"[^>]*>([^<]+)</a>', card)
        location = ", ".join([l.strip() for l in loc_m]) if loc_m else "Not specified"
        # Sometimes location is WFH
        if "Work From Home" in card or "work-from-home" in link.lower():
            location = "Work From Home"
            
        # stipend
        stipend_m = re.search(r'class=[\'"]stipend[\'"][^>]*>([\s\S]*?)</span>', card)
        if stipend_m:
            stipend = re.sub(r'<[^>]+>', '', stipend_m.group(1)).strip()
            # remove extra whitespaces
            stipend = re.sub(r'\s+', ' ', stipend)
            if not stipend.startswith('₹') and ('/' in stipend or '-' in stipend):
                stipend = '₹ ' + stipend
            # remove extra whitespaces
            stipend = re.sub(r'\s+', ' ', stipend)
        else:
            stipend = "Unpaid / Not disclosed"
            
        # duration
        dur_m = re.search(r'>([^<]+(?:Months?|Weeks?))</div>', card, re.IGNORECASE)
        duration = dur_m.group(1).strip() if dur_m else ""

        if link in seen_links: continue
        seen_links.add(link)
        
        cat = "Computer Science" if "computer" in url else "Electronics" if "electronics" in url else "Mechanical" if "mechanical" in url else "Data Science" if "data-science" in url else "Web Dev"
        
        all_internships.append({
            "source": "Internshala",
            "title": title,
            "company": company,
            "location": location,
            "stipend": stipend,
            "duration": duration,
            "link": link,
            "tags": ["B.Tech", cat]
        })

os.makedirs('js', exist_ok=True)
with open("js/live_data.js", "w", encoding="utf-8") as f:
    f.write("window.LIVE_INTERNSHIPS = ")
    json.dump({"success": True, "internships": all_internships, "timestamp": int(time.time()), "cached": True}, f, indent=2)
    f.write(";\n")

print(f"Successfully scraped {len(all_internships)} live internships to js/live_data.js")
