/**
 * Universal SEO Plugin - Core Script
 * Based on Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
 * Improves visibility in SERPs via meta tags, canonical URLs, Open Graph, and structured data.
 * Works with any website: include this script and pass config via window.SEO_CONFIG or data attributes.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc || !doc.head) return;

  /**
   * Get config from: 1) window.SEO_CONFIG, 2) script data attributes, 3) meta name="seo-*"
   */
  function getConfig() {
    if (global.SEO_CONFIG && typeof global.SEO_CONFIG === 'object') {
      return Object.assign({}, global.SEO_CONFIG);
    }
    var script = doc.currentScript || doc.querySelector('script[data-seo-plugin]');
    if (script) {
      var c = {};
      ['title', 'description', 'canonical', 'image', 'siteName', 'siteUrl', 'locale', 'type', 'twitterCard', 'twitterSite'].forEach(function (key) {
        var val = script.getAttribute('data-seo-' + key);
        if (val) c[key] = val;
      });
      var breadcrumb = script.getAttribute('data-seo-breadcrumb');
      if (breadcrumb) try { c.breadcrumb = JSON.parse(breadcrumb); } catch (e) {}
      if (Object.keys(c).length) return c;
    }
    return {};
  }

  /**
   * Ensure a meta tag exists; create or update by name or property.
   */
  function setMeta(attrs, content) {
    if (!content) return;
    var isProperty = 'property' in attrs;
    var key = isProperty ? 'property' : 'name';
    var val = attrs[key];
    var existing = doc.querySelector('meta[' + key + '="' + val + '"]');
    if (existing) {
      existing.setAttribute('content', content);
      return;
    }
    var meta = doc.createElement('meta');
    meta.setAttribute(key, val);
    meta.setAttribute('content', content);
    doc.head.appendChild(meta);
  }

  /**
   * Set or update <title>
   */
  function setTitle(title) {
    if (title) doc.title = title;
  }

  /**
   * Ensure a single canonical link in head.
   */
  function setCanonical(url) {
    if (!url) return;
    var existing = doc.querySelector('head link[rel="canonical"]');
    if (existing) {
      existing.setAttribute('href', url);
      return;
    }
    var link = doc.createElement('link');
    link.rel = 'canonical';
    link.href = url;
    doc.head.appendChild(link);
  }

  /**
   * Inject JSON-LD script (removes existing with same id to avoid duplicates).
   */
  function injectJsonLd(json, id) {
    var scriptId = 'seo-jsonld-' + (id || 'default');
    var old = doc.getElementById(scriptId);
    if (old) old.remove();
    var script = doc.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(json);
    doc.head.appendChild(script);
  }

  /**
   * Build Organization + WebSite schema for better discovery and sitelinks.
   */
  function buildOrganizationSchema(config) {
    var url = config.siteUrl || config.canonical || (global.location && global.location.origin);
    var name = config.siteName || config.title || doc.title;
    if (!url || !name) return null;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': url + '#organization',
          name: name,
          url: url
        },
        {
          '@type': 'WebSite',
          '@id': url + '#website',
          url: url,
          name: name,
          publisher: { '@id': url + '#organization' }
        }
      ]
    };
  }

  /**
   * Build BreadcrumbList from array of { name, url }.
   */
  function buildBreadcrumbSchema(items, baseUrl) {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    var list = items.map(function (item, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: item.name || ('Item ' + (i + 1)),
        item: item.url ? (item.url.indexOf('http') === 0 ? item.url : baseUrl + item.url) : undefined
      };
    });
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: list
    };
  }

  /**
   * Apply full SEO from config.
   */
  function apply(config) {
    if (!config || typeof config !== 'object') return;

    var title = config.title;
    var description = config.description;
    var canonical = config.canonical;
    var image = config.image;
    var siteName = config.siteName;
    var siteUrl = config.siteUrl || (global.location && global.location.origin) || '';
    var locale = config.locale || 'en_US';
    var type = config.type || 'website';
    var twitterCard = config.twitterCard || 'summary_large_image';
    var twitterSite = config.twitterSite || '';

    if (title) setTitle(title);
    if (description) setMeta({ name: 'description' }, description);
    if (canonical) setCanonical(canonical);

    // Open Graph (helps social and some search engines)
    setMeta({ property: 'og:title' }, title || doc.title);
    setMeta({ property: 'og:description' }, description);
    setMeta({ property: 'og:type' }, type);
    setMeta({ property: 'og:url' }, canonical || (global.location && global.location.href));
    setMeta({ property: 'og:image' }, image);
    setMeta({ property: 'og:site_name' }, siteName);
    setMeta({ property: 'og:locale' }, locale);

    // Twitter Card
    setMeta({ name: 'twitter:card' }, twitterCard);
    setMeta({ name: 'twitter:title' }, title || doc.title);
    setMeta({ name: 'twitter:description' }, description);
    setMeta({ name: 'twitter:image' }, image);
    if (twitterSite) setMeta({ name: 'twitter:site' }, twitterSite);

    // Structured data: Organization + WebSite (improves discovery and brand in SERPs)
    var orgSchema = buildOrganizationSchema(config);
    if (orgSchema) injectJsonLd(orgSchema, 'organization');

    // Optional breadcrumb (descriptive URLs / breadcrumbs in SERPs)
    var baseUrl = siteUrl.replace(/\/$/, '');
    var breadcrumbSchema = buildBreadcrumbSchema(config.breadcrumb, baseUrl);
    if (breadcrumbSchema) injectJsonLd(breadcrumbSchema, 'breadcrumb');
  }

  /**
   * Run on DOM ready so head is available.
   */
  function run() {
    var config = getConfig();
    apply(config);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Expose for programmatic use (e.g. SPA route changes)
  global.SEOPlugin = {
    apply: apply,
    setTitle: setTitle,
    setMeta: setMeta,
    setCanonical: setCanonical,
    injectJsonLd: injectJsonLd
  };
})(typeof window !== 'undefined' ? window : this);
