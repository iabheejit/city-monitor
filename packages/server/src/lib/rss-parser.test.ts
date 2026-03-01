/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { parseFeed } from './rss-parser.js';

const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Berlin traffic disruption</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
      <description>Major road closure in Mitte</description>
    </item>
    <item>
      <title>New museum exhibition</title>
      <link>https://example.com/2</link>
      <pubDate>Sun, 28 Feb 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom article</title>
    <link href="https://example.com/atom/1" />
    <published>2026-03-01T12:00:00Z</published>
    <summary>Summary text</summary>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('parses RSS 2.0 feed', () => {
    const items = parseFeed(RSS_FEED);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('Berlin traffic disruption');
    expect(items[0]!.url).toBe('https://example.com/1');
    expect(items[0]!.description).toBe('Major road closure in Mitte');
  });

  it('parses Atom feed', () => {
    const items = parseFeed(ATOM_FEED);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Atom article');
    expect(items[0]!.url).toBe('https://example.com/atom/1');
  });

  it('returns empty array for invalid XML', () => {
    const items = parseFeed('not xml');
    expect(items).toEqual([]);
  });

  it('returns empty array for empty feed', () => {
    const items = parseFeed('<rss><channel></channel></rss>');
    expect(items).toEqual([]);
  });
});
