import Composer from 'discourse/models/composer';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'discovery-compose',
  initialize(){
    Composer.serializeOnCreate('wiki')

    TopicStatusView.reopen({
      renderDiv: true,

      @observes('statuses')
      @on('init')
      _setup(){
        let type = this.get('topic.type')
        let topicIcon = {
          icon: topicIconClass(type),
          title: I18n.t("topic." + type + ".title"),
          openTag: 'span',
          closeTag: 'span'
        }
        this.get('statuses').pushObject(topicIcon)
      }
    })
  }
};
