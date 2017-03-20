import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';

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
    return h('span.topic-title', attrs.title);
  }
});
