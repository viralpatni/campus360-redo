<?php
// ============================================
// Campus360 — Web Scraping Engine
// Scrapes internship listings from multiple sources
// ============================================

class InternshipScraper {

    private $cacheDir;
    private $cacheTTL; // seconds

    public function __construct($cacheTTL = 3600) {
        $this->cacheDir = __DIR__ . '/../data';
        $this->cacheTTL = $cacheTTL;

        // Create cache directory if it doesn't exist
        if (!is_dir($this->cacheDir)) {
            mkdir($this->cacheDir, 0777, true);
        }
    }

    // ---- HTTP Helper ----
    private function fetchURL($url) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.5',
            ],
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]);
        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($html === false || $httpCode !== 200) {
            return ['success' => false, 'error' => $error ?: "HTTP $httpCode"];
        }
        return ['success' => true, 'html' => $html];
    }

    // ---- Cache Helpers ----
    private function getCacheFile($source) {
        return $this->cacheDir . '/' . $source . '_cache.json';
    }

    private function getCache($source) {
        $file = $this->getCacheFile($source);
        if (!file_exists($file)) return null;

        $data = json_decode(file_get_contents($file), true);
        if (!$data || !isset($data['timestamp'])) return null;

        if (time() - $data['timestamp'] > $this->cacheTTL) return null;

        return $data;
    }

    private function setCache($source, $internships) {
        $file = $this->getCacheFile($source);
        $data = [
            'timestamp'   => time(),
            'source'      => $source,
            'count'       => count($internships),
            'internships' => $internships,
        ];
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    // ============================================
    // SOURCE 1: INTERNSHALA (B.Tech Relevant)
    // ============================================

    // B.Tech-relevant Internshala category URLs
    private $btechCategories = [
        'https://internshala.com/internships/computer-science-internship',
        'https://internshala.com/internships/electronics-internship',
        'https://internshala.com/internships/mechanical-engineering-internship',
        'https://internshala.com/internships/civil-engineering-internship',
        'https://internshala.com/internships/web-development-internship',
        'https://internshala.com/internships/mobile-app-development-internship',
        'https://internshala.com/internships/data-science-internship',
        'https://internshala.com/internships/machine-learning-internship',
        'https://internshala.com/internships/artificial-intelligence-ai-internship',
        'https://internshala.com/internships/python-django-development-internship',
        'https://internshala.com/internships/embedded-systems-internship',
        'https://internshala.com/internships/electrical-engineering-internship',
    ];

    public function scrapeInternshala($forceRefresh = false) {
        $source = 'internshala';

        // Check cache first
        if (!$forceRefresh) {
            $cached = $this->getCache($source);
            if ($cached) {
                $cached['cached'] = true;
                return $cached;
            }
        }

        $allInternships = [];
        $seenLinks = [];

        // Scrape each B.Tech-relevant category
        foreach ($this->btechCategories as $url) {
            $result = $this->fetchURL($url);
            if (!$result['success']) continue;

            $parsed = $this->parseInternshala($result['html']);

            // Extract category name from URL for tagging
            $category = '';
            if (preg_match('/internships\/(.+)-internship$/', $url, $m)) {
                $category = ucwords(str_replace('-', ' ', $m[1]));
            }

            foreach ($parsed as $item) {
                $link = $item['link'] ?? '';
                if ($link && isset($seenLinks[$link])) continue; // deduplicate
                $seenLinks[$link] = true;

                // Tag with category
                if ($category) {
                    $item['tags'] = array_merge($item['tags'] ?? [], [$category]);
                }
                $item['tags'] = array_merge($item['tags'] ?? [], ['B.Tech']);

                $allInternships[] = $item;
            }

            // Limit total to avoid too many requests
            if (count($allInternships) >= 60) break;
        }

        $this->setCache($source, $allInternships);

        return [
            'success'     => true,
            'source'      => $source,
            'cached'      => false,
            'timestamp'   => time(),
            'count'       => count($allInternships),
            'internships' => $allInternships,
        ];
    }

    private function parseInternshala($html) {
        $internships = [];

        // Suppress DOM parsing warnings (Internshala HTML is messy)
        libxml_use_internal_errors(true);

        $doc = new DOMDocument();
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html);

        $xpath = new DOMXPath($doc);

        // Internshala internship cards use various container classes
        // Primary selector: .internship_meta or individual_internship class
        $cards = $xpath->query('//div[contains(@class, "individual_internship")]');

        if ($cards->length === 0) {
            // Fallback: try alternate selectors
            $cards = $xpath->query('//div[contains(@class, "internship_meta")]');
        }

        // If DOM parsing found cards, parse them
        if ($cards->length > 0) {
            foreach ($cards as $card) {
                $internship = $this->parseInternshalaCard($xpath, $card);
                if ($internship) {
                    $internships[] = $internship;
                }
            }
        }

        // If no cards found via DOM, try regex-based extraction as fallback
        if (empty($internships)) {
            $internships = $this->parseInternshalaRegex($html);
        }

        libxml_clear_errors();
        return $internships;
    }

    private function parseInternshalaCard($xpath, $card) {
        $internship = [
            'source' => 'Internshala',
        ];

        // Title
        $titleNodes = $xpath->query('.//h3//a | .//a[contains(@class, "job-title-href")]', $card);
        if ($titleNodes->length > 0) {
            $titleNode = $titleNodes->item(0);
            $internship['title'] = trim($titleNode->textContent);
            $href = $titleNode->getAttribute('href');
            if ($href && strpos($href, 'http') !== 0) {
                $href = 'https://internshala.com' . $href;
            }
            $internship['link'] = $href;
        } else {
            return null; // skip cards without title
        }

        // Company
        $companyNodes = $xpath->query('.//p[contains(@class, "company")]//a | .//a[contains(@class, "link_display_like_text")]', $card);
        if ($companyNodes->length > 0) {
            $internship['company'] = trim($companyNodes->item(0)->textContent);
        } else {
            // Fallback
            $companyNodes = $xpath->query('.//h4', $card);
            $internship['company'] = $companyNodes->length > 0 ? trim($companyNodes->item(0)->textContent) : 'Unknown';
        }

        // Location
        $locNodes = $xpath->query('.//*[contains(@class, "location")]//a | .//*[contains(@class, "location")]//span', $card);
        if ($locNodes->length > 0) {
            $internship['location'] = trim($locNodes->item(0)->textContent);
        } else {
            $internship['location'] = 'Not specified';
        }

        // Stipend
        $stipendNodes = $xpath->query('.//*[contains(@class, "stipend")]', $card);
        if ($stipendNodes->length > 0) {
            $internship['stipend'] = trim($stipendNodes->item(0)->textContent);
        } else {
            $internship['stipend'] = 'Unpaid / Not disclosed';
        }

        // Duration
        $durationNodes = $xpath->query('.//*[contains(@class, "duration")]', $card);
        if ($durationNodes->length > 0) {
            $internship['duration'] = trim($durationNodes->item(0)->textContent);
        } else {
            $internship['duration'] = 'Not specified';
        }

        // Posted date / Start date
        $dateNodes = $xpath->query('.//*[contains(@class, "start_date")]', $card);
        if ($dateNodes->length > 0) {
            $internship['start_date'] = trim($dateNodes->item(0)->textContent);
        }

        // Apply by
        $applyNodes = $xpath->query('.//*[contains(@class, "apply_by")]', $card);
        if ($applyNodes->length > 0) {
            $internship['apply_by'] = trim($applyNodes->item(0)->textContent);
        }

        // Applicants
        $applicantNodes = $xpath->query('.//*[contains(@class, "applications_message")]', $card);
        if ($applicantNodes->length > 0) {
            $internship['applicants'] = trim($applicantNodes->item(0)->textContent);
        }

        // Tags (WFH, Part-time etc.)
        $tags = [];
        $tagNodes = $xpath->query('.//*[contains(@class, "status")]//span | .//*[contains(@class, "tag")]', $card);
        foreach ($tagNodes as $tag) {
            $tagText = trim($tag->textContent);
            if ($tagText) $tags[] = $tagText;
        }
        if (!empty($tags)) {
            $internship['tags'] = $tags;
        }

        return $internship;
    }

    private function parseInternshalaRegex($html) {
        $internships = [];

        // Extract internship detail URLs and titles from the page
        $pattern = '/<a[^>]*href="(\/internship\/detail\/[^"]+)"[^>]*>([^<]+)<\/a>/i';
        preg_match_all($pattern, $html, $matches, PREG_SET_ORDER);

        $seen = [];
        foreach ($matches as $match) {
            $link = 'https://internshala.com' . $match[1];
            $title = trim($match[2]);

            // Skip duplicates and navigation links
            if (isset($seen[$link]) || strlen($title) < 3) continue;
            $seen[$link] = true;

            // Extract location from URL pattern
            $location = 'Not specified';
            if (preg_match('/internship-in-([a-z-]+)-at-/', $match[1], $locMatch)) {
                $location = ucwords(str_replace('-', ' ', $locMatch[1]));
                if ($location === 'Multiple Locations') $location = 'Multiple Locations';
            } elseif (preg_match('/work-from-home/', $match[1])) {
                $location = 'Work from Home';
            }

            // Extract company from URL pattern
            $company = 'Unknown';
            if (preg_match('/-at-([a-z0-9-]+?)(\d{5,})$/', $match[1], $compMatch)) {
                $company = ucwords(str_replace('-', ' ', $compMatch[1]));
            }

            $internships[] = [
                'source'   => 'Internshala',
                'title'    => $title,
                'company'  => $company,
                'location' => $location,
                'stipend'  => 'View on Internshala',
                'duration' => 'View on Internshala',
                'link'     => $link,
            ];

            if (count($internships) >= 50) break; // Limit results
        }

        return $internships;
    }

    // ============================================
    // SOURCE 2: WEBSCRAPER.IO TEST SITE
    // (Demo second source - e-commerce test site)
    // ============================================
    public function scrapeWebscraperDemo($forceRefresh = false) {
        $source = 'webscraper';

        if (!$forceRefresh) {
            $cached = $this->getCache($source);
            if ($cached) {
                $cached['cached'] = true;
                return $cached;
            }
        }

        $url = 'https://webscraper.io/test-sites/e-commerce/allinone';
        $result = $this->fetchURL($url);

        if (!$result['success']) {
            return [
                'success' => false,
                'source'  => $source,
                'error'   => 'Failed to fetch Webscraper demo: ' . $result['error'],
            ];
        }

        $items = $this->parseWebscraperDemo($result['html']);

        $this->setCache($source, $items);

        return [
            'success'   => true,
            'source'    => $source,
            'cached'    => false,
            'timestamp' => time(),
            'count'     => count($items),
            'internships' => $items,
        ];
    }

    private function parseWebscraperDemo($html) {
        $items = [];

        libxml_use_internal_errors(true);
        $doc = new DOMDocument();
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html);
        $xpath = new DOMXPath($doc);

        // Parse product cards from webscraper.io test site
        $cards = $xpath->query('//div[contains(@class, "thumbnail")]');

        foreach ($cards as $card) {
            // Title
            $titleNodes = $xpath->query('.//a[contains(@class, "title")]', $card);
            $title = $titleNodes->length > 0 ? trim($titleNodes->item(0)->textContent) : '';

            // Price
            $priceNodes = $xpath->query('.//h4[contains(@class, "price")] | .//span[contains(@class, "price")]', $card);
            $price = $priceNodes->length > 0 ? trim($priceNodes->item(0)->textContent) : '';

            // Description
            $descNodes = $xpath->query('.//p[contains(@class, "description")]', $card);
            $desc = $descNodes->length > 0 ? trim($descNodes->item(0)->textContent) : '';

            // Link
            $linkNodes = $xpath->query('.//a[contains(@class, "title")]', $card);
            $link = '';
            if ($linkNodes->length > 0) {
                $href = $linkNodes->item(0)->getAttribute('href');
                $link = 'https://webscraper.io' . $href;
            }

            if ($title) {
                $items[] = [
                    'source'      => 'Webscraper Demo',
                    'title'       => $title . ' (Demo Listing)',
                    'company'     => 'Webscraper.io Test Site',
                    'location'    => 'Online / Demo',
                    'stipend'     => $price ?: 'N/A',
                    'duration'    => 'Demo',
                    'description' => $desc,
                    'link'        => $link,
                    'tags'        => ['Demo', 'Test Data'],
                ];
            }
        }

        libxml_clear_errors();
        return $items;
    }

    // ============================================
    // COMBINED: Get all sources
    // ============================================
    public function scrapeAll($forceRefresh = false) {
        $internshala = $this->scrapeInternshala($forceRefresh);
        $webscraper  = $this->scrapeWebscraperDemo($forceRefresh);

        $all = [];

        if (isset($internshala['internships'])) {
            $all = array_merge($all, $internshala['internships']);
        }
        if (isset($webscraper['internships'])) {
            $all = array_merge($all, $webscraper['internships']);
        }

        return [
            'success'     => true,
            'sources'     => [
                'internshala' => $internshala['success'] ?? false,
                'webscraper'  => $webscraper['success'] ?? false,
            ],
            'cached'      => ($internshala['cached'] ?? false) && ($webscraper['cached'] ?? false),
            'timestamp'   => time(),
            'count'       => count($all),
            'internships' => $all,
        ];
    }

    // Search/filter internships
    public function search($query, $source = 'all', $forceRefresh = false) {
        if ($source === 'internshala') {
            $data = $this->scrapeInternshala($forceRefresh);
        } elseif ($source === 'webscraper') {
            $data = $this->scrapeWebscraperDemo($forceRefresh);
        } else {
            $data = $this->scrapeAll($forceRefresh);
        }

        if (!isset($data['internships'])) {
            return $data;
        }

        $query = strtolower(trim($query));
        if (empty($query)) return $data;

        $filtered = array_filter($data['internships'], function($item) use ($query) {
            $searchable = strtolower(
                ($item['title'] ?? '') . ' ' .
                ($item['company'] ?? '') . ' ' .
                ($item['location'] ?? '') . ' ' .
                ($item['stipend'] ?? '') . ' ' .
                ($item['duration'] ?? '') . ' ' .
                implode(' ', $item['tags'] ?? [])
            );
            return strpos($searchable, $query) !== false;
        });

        $data['internships'] = array_values($filtered);
        $data['count'] = count($data['internships']);
        $data['query'] = $query;

        return $data;
    }
}
