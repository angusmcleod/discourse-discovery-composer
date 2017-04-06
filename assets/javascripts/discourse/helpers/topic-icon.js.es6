import { registerUnbound } from 'discourse-common/lib/helpers';
import topicIconClass from '../lib/topic-icon-class';

function renderTopicIcon(topic) {
  if (topic.get('subtype')) {
    return `<i class="fa fa-${topicIconClass(topic.get('subtype'))}"></i>`;
  } else {
    return '';
  }
};

export default registerUnbound('topic-icon', function(topic) {
  return new Handlebars.SafeString(renderTopicIcon(topic));
});
