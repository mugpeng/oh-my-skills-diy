#!/usr/bin/env python3
"""
Web search fallback for Reddit data when API is blocked.
Uses Brave Search to find subreddits and posts.
"""
import urllib.request
import urllib.parse
import re
import sys

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def web_search(query: str, max_results: int = 10) -> list[dict]:
    """Search via Brave and return results with title + url"""
    url = "https://search.brave.com/search?" + urllib.parse.urlencode({"q": query})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode(errors="replace")
    except Exception as e:
        print(f"error: Web search failed: {e}", file=sys.stderr)
        return []

    results = []
    seen = set()

    # Extract all reddit.com links from the page
    links = re.findall(r'href="(https?://(?:www\.)?reddit\.com/r/[^"]+)"', html)

    for raw_url in links:
        if raw_url in seen:
            continue
        seen.add(raw_url)

        # Extract subreddit name
        m = re.search(r'reddit\.com/r/([A-Za-z0-9_]+)', raw_url)
        if not m:
            continue

        sub = m.group(1)
        if sub in ("comments", "wiki", "about", "search", "submit"):
            # It's a post link, extract title from URL path
            title_m = re.search(r'/comments/\w+/([^/?]+)', raw_url)
            title = title_m.group(1).replace("_", " ").title() if title_m else f"r/{sub} post"
        else:
            title = f"r/{sub}"

        results.append({"title": title, "url": raw_url, "subreddit": sub})
        if len(results) >= max_results:
            break

    return results


def extract_subreddit_names(query: str, max_results: int = 20) -> list[str]:
    """Find subreddit names related to a query"""
    results = web_search(f"{query} reddit subreddit", max_results)
    subs = []
    seen = set()
    for r in results:
        name = r.get("subreddit", "")
        if name and name not in seen:
            seen.add(name)
            subs.append(name)
    return subs


def search_subreddit_posts(subreddit: str, topic: str, max_results: int = 10) -> list[dict]:
    """Search for posts in a specific subreddit"""
    results = web_search(f"site:reddit.com/r/{subreddit} {topic}", max_results)
    posts = []
    for r in results:
        posts.append({
            "title": r["title"],
            "url": r["url"],
            "snippet": r.get("snippet", ""),
        })
    return posts


def get_subreddit_info(subreddit: str) -> dict:
    """Get subreddit info from web search results"""
    results = web_search(f"r/{subreddit} reddit", 5)
    info = {"name": subreddit, "url": f"https://reddit.com/r/{subreddit}"}

    for r in results:
        if "snippet" in r and r["snippet"]:
            m = re.search(r'([\d,]+)\s*(?:members|subscribers|joined)', r["snippet"], re.I)
            if m:
                info["subscribers_text"] = m.group(1)

    return info


# ── CLI interface ──────────────────────────────────────

def cmd_find_subs(query: str):
    """Find subreddits for a topic"""
    subs = extract_subreddit_names(query)
    if not subs:
        print("No subreddits found via DuckDuckGo")
        return
    print(f"subreddits for '{query}':")
    for i, sub in enumerate(subs, 1):
        print(f"  {i}. r/{sub}")


def cmd_subreddit_info(subreddit: str):
    """Get subreddit info"""
    info = get_subreddit_info(subreddit)
    print(f"name: r/{info['name']}")
    print(f"url: {info['url']}")
    if "subscribers_text" in info:
        print(f"subscribers: ~{info['subscribers_text']}")
    if "description" in info:
        print(f"description: {info['description']}")
    print(f"note: Data from DuckDuckGo search, may be incomplete")


def cmd_search_posts(subreddit: str, topic: str):
    """Search posts in a subreddit"""
    posts = search_subreddit_posts(subreddit, topic)
    if not posts:
        print(f"No posts found for '{topic}' in r/{subreddit}")
        return
    print(f"Posts about '{topic}' in r/{subreddit}:")
    for i, p in enumerate(posts, 1):
        print(f"  {i}. {p['title']}")
        print(f"     {p['url']}")
        if p['snippet']:
            print(f"     {p['snippet'][:100]}")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 ddg_fallback.py find <query>")
        print("  python3 ddg_fallback.py info <subreddit>")
        print("  python3 ddg_fallback.py search <subreddit> <topic>")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "find" and len(sys.argv) >= 3:
        cmd_find_subs(" ".join(sys.argv[2:]))
    elif cmd == "info" and len(sys.argv) >= 3:
        cmd_subreddit_info(sys.argv[2])
    elif cmd == "search" and len(sys.argv) >= 4:
        cmd_search_posts(sys.argv[2], " ".join(sys.argv[3:]))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
