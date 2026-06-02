---
name: peng-post-to-xhs-write
description: "Write and polish XHS post copy: anti-AI tone, first-person voice, character limits. Use when user asks to write, edit, or polish 小红书文案/笔记文案/正文/标题."
---

# Post to Xiaohongshu — Write

Write and polish XHS post copy with natural, anti-AI tone.

## Hard Limits

- Title: **≤ 20 characters** (aim ≤ 18 for safety)
- Body: **≤ 1000 characters** (aim ≤ 950 for safety)
- Counting: all characters including spaces, punctuation, newlines, #tags

## Anti-AI Writing Rules

1. **Use "我" perspective**: "我发现", "我踩过的坑", "我当时" — NOT "大家/用户/建议如下"
2. **Add 2-3 specific details**: a timestamp, a scene, a before/after comparison, an exact quote
3. **Allow imperfection**: "我感觉/可能/不确定但…" — don't sound authoritative
4. **No template phrases**: avoid "总的来说/综上/因此/首先其次最后/不容错过/速速"
5. **Talk like a friend**: short sentences, line breaks every 1-3 sentences, occasional colloquialisms

## Structure

Good XHS copy follows a natural arc, not a rigid template. Pick the pattern that fits the content:

| Pattern | Flow | Best for |
|---------|------|----------|
| Pain → Discovery | 痛点场景 → 发现解法 → 具体用法 → 感受 | 工具推荐、经验分享 |
| Before → After | 之前的笨办法 → 现在的聪明办法 → 差异对比 | 效率提升、工作流优化 |
| Confusion → Clarity | 一开始搞不懂 → 摸索过程 → 最终理清 | 教程、概念解释 |
| Story → Takeaway | 一段经历 → 提炼出 2-3 个要点 | 踩坑分享、职场经验 |

### Opening (hook)

First 2 lines decide if the reader stays. Pick one:

- **Scenario hook**: "昨天半夜 debug 到两点，终于搞明白了"
- **Question hook**: "你们有没有那种…的体验？"
- **Contrast hook**: "之前一直以为 XX 很难，直到发现了 YY"
- **Quote hook**: "看到 XX 说了句话，我直接共鸣了"

### Closing (engagement)

End with a natural invitation, not a forced CTA:

- "试试看，说不定能帮到你"
- "有更好的方法欢迎评论区告诉我"
- "如果觉得有用可以收藏一下"

NOT: "赶紧收藏！" / "不容错过！" / "速速马住！"

## Tone Presets

Adjust tone based on content type. Default: `conversational`.

| Preset | Voice | When |
|--------|-------|------|
| `conversational` | 像跟朋友聊天，短句为主，偶尔口语 | Default, most posts |
| `enthusiastic` | 发现好东西的兴奋感，"绝了/太好用了" | 工具推荐、惊喜发现 |
| `calm` | 平和分享，不带情绪夸张 | 教程、知识科普 |
| `storytelling` | 有场景感的叙事，带入体验 | 经历分享、踩坑故事 |

## Rhythm Checklist

Before finalizing, check:

- [ ] Every paragraph is 1-3 sentences (no walls of text)
- [ ] Sentence length varies (mix short punches with medium ones)
- [ ] No 3+ consecutive sentences with the same structure
- [ ] At least one personal detail (time, place, feeling, quote)
- [ ] No more than 1 emoji per 3 lines (emoji as seasoning, not decoration)

## Output Format

```text
标题：<title>（<char count>/20）
正文：
<body>
（<char count>/1000）

标签：#tag1 #tag2 #tag3
```

## Character Check

If title > 20 chars: cut redundant words, remove subtitles, shorten.
If body > 1000 chars: remove repetition, merge sentences, compress steps.
