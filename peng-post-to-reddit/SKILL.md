---
name: peng-post-to-reddit
description: "Convert articles into Reddit-ready posts and recommend target subreddits. Analyzes content, finds matching communities, adapts tone/format per subreddit. Use when user asks to post on Reddit, convert to Reddit format, or find subreddits for their content."
---

# Post to Reddit (Research + Format)

Convert user articles into Reddit-optimized posts and recommend target subreddits. No actual publishing — output is publish-ready copy + community strategy.

## Script Directory

`{baseDir}` = this SKILL.md's directory. All scripts use Reddit's public JSON API — no API key required.

| Script | Purpose |
|--------|---------|
| `scripts/search_posts.py` | Search posts across Reddit or within a subreddit |
| `scripts/get_subreddit.py` | Get subreddit info (subscribers, rules, description) |
| `scripts/get_posts.py` | Get posts from a subreddit (hot/new/top/rising) |
| `scripts/get_post.py` | Get a specific post with comments |
| `scripts/get_user.py` | Get user profile and recent posts |

## Workflow

```
Phase 1: Analyze   → extract core topic, value proposition, content type
Phase 2: Discover  → find 3-5 matching subreddits with reasoning
Phase 3: Adapt     → rewrite per subreddit (title, body, flair, format)
Phase 4: Advise    → posting strategy (timing, rules, engagement tips)
```

---

## Phase 1: Analyze Article

Read the user's article and extract:

| Field | What to identify |
|-------|-----------------|
| **Core topic** | 1-2 sentence summary |
| **Value proposition** | What does the reader gain? |
| **Content type** | Experience / Tutorial / Tool / Question / Discussion / Case Study |
| **Key claims** | 3-5 main points |
| **Promotional level** | Pure value / Soft mention / Product showcase |
| **Target audience** | Developers / Founders / Hobbyists / General |

Output a brief analysis before proceeding.

---

## Phase 2: Discover Subreddits

### Search with local scripts

```bash
# Search for related content across Reddit
python3 {baseDir}/scripts/search_posts.py "<topic keywords>" --limit 20 --sort top

# Check specific subreddit info (subscribers, description)
python3 {baseDir}/scripts/get_subreddit.py <subreddit_name>

# See what performs well in a subreddit
python3 {baseDir}/scripts/get_posts.py <subreddit_name> --sort top --time month --limit 10

# Get a specific post with comments for deeper analysis
python3 {baseDir}/scripts/get_post.py <post_id> --comments 30
```

### Fallback: when Reddit API is blocked

If any script outputs `FALLBACK:reddit_api_blocked`, the Reddit API is inaccessible. Use this 3-level fallback:

**Level 1**: Try the built-in fallback script (uses Brave Search):
```bash
python3 {baseDir}/scripts/ddg_fallback.py find "<topic>"
python3 {baseDir}/scripts/ddg_fallback.py info <subreddit>
python3 {baseDir}/scripts/ddg_fallback.py search <subreddit> "<topic>"
```

**Level 2**: If that also fails, use `WebSearch` tool directly:
- `site:reddit.com "<topic>" subreddit` — find relevant subreddits
- `site:reddit.com r/<subreddit>` — check subreddit info
- `site:reddit.com "<topic>" top posts` — find popular posts on the topic

**Level 3**: If web search is also unavailable, use your knowledge of Reddit to recommend subreddits based on the topic. Common subreddits by category:
- Tech: r/programming, r/learnprogramming, r/coding, r/webdev
- AI: r/MachineLearning, r/artificial, r/LocalLLaMA, r/AI_Agents
- Business: r/Entrepreneur, r/SideProject, r/startups
- General: r/technology, r/InternetIsBeautiful, r/todayilearned

### Selection criteria

For each candidate subreddit, evaluate:

| Factor | What to check |
|--------|--------------|
| **Size** | Subscriber count (10K-500K is sweet spot for visibility) |
| **Relevance** | Does the topic fit the subreddit's stated purpose? |
| **Rules** | Does the post comply? (self-promotion limits, required flair, title format) |
| **Activity** | Recent post frequency, comment engagement |
| **Competition** | Are similar posts already there? (good = demand, bad = saturation) |
| **Promotion tolerance** | Some subs ban links, some require self-post only |

### Output format

```text
【推荐子版块】

1. r/<name> — <subscriber count>
   匹配度：★★★★★
   理由：<why this fits>
   规则注意：<key rules to watch>
   风险：<what could go wrong>

2. r/<name> — <subscriber count>
   ...
```

Recommend 3-5 subreddits, ranked by fit.

---

## Phase 3: Adapt Content per Subreddit

For each recommended subreddit, produce a tailored version.

### Reddit formatting rules

**Title**:
- Concise, specific, factual — no clickbait
- Match subreddit format: some require [tags] like [Discussion], [Question], [Showoff Saturday]
- Save opinions for body, not title
- Check top posts in the subreddit for title style

**Body**:
- **Value first**: lead with the insight, not the context
- **Casual tone**: like talking to a peer, not writing a blog post
- **Structure**: use headers, lists, code blocks for readability
- **End with engagement**: open-ended question to invite discussion
- **Markdown**: bold, italic, lists, code blocks, links

**Content types**:

| Type | Best for | Structure |
|------|----------|-----------|
| Experience sharing | Highest engagement | What happened → What I learned → What do you think? |
| Tutorial | Technical subs | Problem → Solution → Steps → Results |
| Tool/product | Must be transparent | Context → What I built → Honest pros/cons → Link |
| Q&A | Build trust | Specific question + your attempt → Ask for help |
| Discussion | Community building | Observation → Evidence → What's your take? |

### Self-promotion rules

- **90/10 principle**: 90% value, 10% promotional
- **Max 1 in 6 posts** should be self-promotional
- If the article promotes something, lead with the problem/insight, not the product
- Add a disclaimer if affiliate/sponsorship: "Full disclosure: I built this"

### Output per subreddit

```text
=== r/<name> ===

标题: <adapted title>

正文:
<adapted body, Markdown formatted>

Flair: <suggested flair>
格式: <link post / self post / image post>
```

---

## Phase 4: Posting Strategy

### Timing

| Subreddit type | Best posting times (US Eastern) |
|---------------|-------------------------------|
| US-centric | Tue-Thu, 9-11 AM ET |
| Global/tech | Mon-Fri, 8-10 AM ET or 2-4 PM ET |
| Casual/hobby | Weekends, 10 AM - 2 PM ET |

### After posting

- **Reply to comments** within the first 1-2 hours (boosts ranking)
- **Don't delete and repost** if it flops (subreddits track this)
- **Cross-post** to related subs only after 24h, and only if rules allow
- **Engage genuinely**: answer questions, acknowledge criticism, thank feedback

### Karma strategy

If user has low karma (<100):
- Post non-promotional content first to build reputation
- Comment helpfully in target subreddits before posting
- Avoid posting promotional content until karma is 100+

---

## Limitations

- No actual publishing — output is copy + strategy only
- Subreddit rules change; always verify before posting
- Reddit public JSON API: 100 requests/minute rate limit

## Examples

### Full pipeline

User: "帮我把这篇文章发到 Reddit 上"

1. Read article → extract topic, value, content type
2. Search Reddit for matching subreddits
3. Recommend 3-5 subreddits with reasoning
4. Adapt title + body for each subreddit
5. Output all versions + posting strategy

### Subreddit discovery only

User: "哪些 Reddit 板块适合讨论 AI agent?"

1. Search for AI agent related subreddits
2. Compare size, activity, relevance
3. Output ranked list with pros/cons

### Format conversion only

User: "把这篇教程改成 Reddit 帖子格式"

1. Read tutorial
2. Convert to Reddit-friendly structure (headers, lists, casual tone)
3. Add engagement hook at the end
4. Output formatted post
