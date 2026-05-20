/**
 * SEO Handler for Dynamic Meta Tag Management
 * This script dynamically updates meta tags when chapters are loaded
 * Improves SEO for search engines and social media sharing
 */

class SEOHandler {
    constructor() {
        this.siteUrl = window.location.origin;
        this.defaultOGImage = `${this.siteUrl}/og-image.png`;
        this.defaultTwitterImage = `${this.siteUrl}/twitter-image.png`;
    }

    /**
     * Update page meta tags dynamically based on chapter data
     */
    updatePageMetaTags(chapterData) {
        if (!chapterData) return;

        // Update document title
        document.title = `${chapterData.title} | CUET History Master`;

        // Update meta description
        this.updateMetaTag('description', 
            `Learn about ${chapterData.title} with AI-powered analysis, timelines, historians' perspectives, and CUET past year questions.`
        );

        // Update meta keywords
        const keywords = chapterData.recurringTopics ? 
            `${chapterData.title}, CUET History, ${chapterData.recurringTopics.join(', ')}, NCERT` :
            `${chapterData.title}, CUET History, NCERT, exam preparation`;
        this.updateMetaTag('keywords', keywords);

        // Update canonical URL
        this.updateCanonicalURL(`${this.siteUrl}/chapter/${chapterData.id}`);

        // Update Open Graph tags
        this.updateOGTags({
            title: chapterData.title,
            description: `Master ${chapterData.title} for CUET exam with comprehensive notes, practice questions, and AI insights.`,
            url: `${this.siteUrl}/chapter/${chapterData.id}`,
            image: this.defaultOGImage,
            type: 'website'
        });

        // Update Twitter Card tags
        this.updateTwitterTags({
            title: chapterData.title,
            description: `Learn ${chapterData.title} for CUET: AI-powered study guide with past papers & assertion-reason questions`,
            image: this.defaultTwitterImage,
            url: `${this.siteUrl}/chapter/${chapterData.id}`
        });

        // Update structured data
        this.updateStructuredData(chapterData);
    }

    /**
     * Update a meta tag
     */
    updateMetaTag(name, content) {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.name = name;
            document.head.appendChild(tag);
        }
        tag.content = content;
    }

    /**
     * Update Open Graph tags
     */
    updateOGTags(data) {
        const ogProperties = {
            'og:title': data.title,
            'og:description': data.description,
            'og:url': data.url,
            'og:type': data.type || 'website',
            'og:image': data.image,
            'og:image:alt': data.title
        };

        Object.entries(ogProperties).forEach(([property, content]) => {
            this.updateMetaProperty(property, content);
        });
    }

    /**
     * Update Twitter Card tags
     */
    updateTwitterTags(data) {
        const twitterTags = {
            'twitter:card': 'summary_large_image',
            'twitter:title': data.title,
            'twitter:description': data.description,
            'twitter:image': data.image,
            'twitter:url': data.url
        };

        Object.entries(twitterTags).forEach(([name, content]) => {
            this.updateMetaTag(name, content);
        });
    }

    /**
     * Update a meta property tag
     */
    updateMetaProperty(property, content) {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', property);
            document.head.appendChild(tag);
        }
        tag.content = content;
    }

    /**
     * Update canonical URL
     */
    updateCanonicalURL(url) {
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = url;
    }

    /**
     * Update structured data (JSON-LD)
     */
    updateStructuredData(chapterData) {
        // Remove old structured data
        const oldStructuredData = document.querySelector('script[data-type="chapter-data"]');
        if (oldStructuredData) {
            oldStructuredData.remove();
        }

        // Create new structured data
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "LearningResource",
            "name": chapterData.title,
            "description": `NCERT-based chapter on ${chapterData.title} for CUET exam preparation`,
            "url": `${this.siteUrl}/chapter/${chapterData.id}`,
            "author": {
                "@type": "Organization",
                "name": "CUET History Master",
                "url": this.siteUrl
            },
            "educationalLevel": "College/University",
            "learningResourceType": "Study Guide",
            "inLanguage": "en",
            "keywords": chapterData.recurringTopics?.join(', ') || chapterData.title
        };

        // Add to head
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-type', 'chapter-data');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    /**
     * Reset to homepage meta tags
     */
    resetToHomepage() {
        document.title = 'CUET History Master | NCERT Based Study Guide';
        this.updateMetaTag('description',
            'Master CUET History with AI-powered study guides, NCERT chapter notes, past year questions, assertion-reason practice, and personalized exam preparation tools.'
        );
        this.updateMetaTag('keywords',
            'CUET History, NCERT History, exam preparation, study guide, past year questions, history notes, assertion-reason questions, CUET exam'
        );
        this.updateCanonicalURL(`${this.siteUrl}/`);
        this.updateOGTags({
            title: 'CUET History Master | NCERT Based Study Guide',
            description: 'Master CUET History with AI-powered study guides and comprehensive exam preparation resources.',
            url: this.siteUrl,
            image: this.defaultOGImage,
            type: 'website'
        });
    }

    /**
     * Log SEO info (for debugging)
     */
    logSEOInfo() {
        console.log('=== SEO Info ===');
        console.log('Title:', document.title);
        console.log('Description:', document.querySelector('meta[name="description"]')?.content);
        console.log('Canonical URL:', document.querySelector('link[rel="canonical"]')?.href);
        console.log('OG Image:', document.querySelector('meta[property="og:image"]')?.content);
        console.log('=================');
    }
}

// Initialize SEO handler globally
const seoHandler = new SEOHandler();
