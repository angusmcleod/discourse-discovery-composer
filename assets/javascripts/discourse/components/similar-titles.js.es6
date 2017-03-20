import MountWidget from 'discourse/components/mount-widget';
import { observes, on } from 'ember-addons/ember-computed-decorators';

export default MountWidget.extend({
  tagName: 'ul',
  classNames: ["similar-titles"],
  widget: 'similar-titles',
  topics: [],

  @observes('topics.[]')
  _rerender() {
    this.queueRerender();
  },

  buildArgs() {
    return {
      topics: this.get('topics')
    };
  }
});
