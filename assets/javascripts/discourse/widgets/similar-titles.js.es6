import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';

export default createWidget('similar-titles', {
  html(attrs) {
    return attrs.topics.map(t => {
      return h('li', this.attach('similar-title-link', {
        url: t.url,
        title: t.title
      }));
    });
  }
});
