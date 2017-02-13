import MountWidget from 'discourse/components/mount-widget';
import { observes, on } from 'ember-addons/ember-computed-decorators';

export default MountWidget.extend({
  tagName: 'ul',
  classNames: ["similar-title-topics"],
  widget: 'search-result-topic',
  topics: [],

  @observes('topics.[]')
  _rerender() {
    this.queueRerender();
  },

  buildArgs() {
    return {
      results: this.get('topics')
    };
  }
});
