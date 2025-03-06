---
layout: page
title: Articles
permalink: /articles/
description: Research papers and articles by members of The Visible College
nav: true
nav_order: 4
horizontal: true
---

<!-- pages/articles.md -->
<div class="articles">

{% if site.enable_article_categories and page.display_categories %}
  <!-- Display categorized articles -->
  {% for category in page.display_categories %}
  <a id="{{ category }}" href=".#{{ category }}">
    <h2 class="category">{{ category }}</h2>
  </a>
  {% assign categorized_articles = site.articles | where: "category", category %}
  {% assign sorted_articles = categorized_articles | sort: "importance" %}
  <!-- Generate cards for each article -->
  {% if page.horizontal %}
  <div class="container">
    <div class="row row-cols-1 row-cols-md-1">
    {% for article in sorted_articles %}
      {% include articles_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for article in sorted_articles %}
      {% include articles.liquid %}
    {% endfor %}
  </div>
  {% endif %}
  {% endfor %}

{% else %}

<!-- Display articles without categories -->

{% assign sorted_articles = site.articles | sort: "importance" %}

  <!-- Generate cards for each article -->

{% if page.horizontal %}

  <div class="container">
    <div class="row row-cols-1 row-cols-md-1">
    {% for article in sorted_articles %}
      {% include articles_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for article in sorted_articles %}
      {% include articles.liquid %}
    {% endfor %}
  </div>
  {% endif %}
{% endif %}
</div> 