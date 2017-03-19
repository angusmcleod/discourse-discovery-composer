import { createWidget } from 'discourse/widgets/widget';
import RawHtml from 'discourse/widgets/raw-html';
import { h } from 'virtual-dom';

class Highlighted extends RawHtml {
  constructor(html, term) {
    super({ html: `<span>${html}</span>` });
    this.term = term;
  }

  decorate($html) {
    if (this.term) {
      $html.highlight(this.term.split(/\s+/), { className: 'search-highlight' });
    }
  }
}

export default createWidget('similar-topic-link', {
  tagName: 'a.similar-topic-link',

  buildClasses(attrs) {
    return 'search-link';
  },

  buildAttributes(attrs) {
    return { href: attrs.url,
             target: "_blank",
             title: attrs.url };
  },

  html(attrs) {
    const result = attrs.result;
    const topic = result.topic;
    const term = attrs.term;
    const link = h('span.topic', [
      this.attach('topic-status', { topic, disableActions: true }),
      h('span.topic-title', new Highlighted(topic.get('fancyTitle'), term))
    ])

    return [link, term];
  }
});
