# name: discourse-discovery-composer
# about: Adds a composer to the discovery stream
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/discovery-composer.scss'

after_initialize do

  PostRevisor.track_topic_field(:wiki)

  DiscourseEvent.on(:post_created) do |post, opts, user|
    if post.is_first_post?
      topic = Topic.find(post.topic_id)
      type = opts[:tags].first
      if type == 'wiki'
        post.wiki = true
        post.save
      end
      topic.custom_fields['topic_type'] = type
      topic.save!
    end
  end

  TopicList.preloaded_custom_fields << "topic_type" if TopicList.respond_to? :preloaded_custom_fields
  add_to_serializer(:topic_list_item, :type) {object.custom_fields["topic_type"]}
  add_to_serializer(:topic_view, :type) {object.topic.custom_fields["topic_type"]}
end
