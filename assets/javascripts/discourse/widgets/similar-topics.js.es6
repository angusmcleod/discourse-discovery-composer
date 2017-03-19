import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';

export default createWidget('similar-topic', {
  html(attrs) {
    return attrs.results.map(r => {
      return h('li', this.attach('similar-topic-link', {
        url: r.get('url'),
        result: r,
        term: attrs.term,
        className: 'search-link'
      }));
    });
  }
});
