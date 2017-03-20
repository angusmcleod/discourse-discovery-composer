# name: discourse-discovery-composer
# about: Adds a composer to the discovery stream
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/discovery-composer.scss'

after_initialize do
  TYPE_MODEL = "tf-cnn-text"

  module ::DiscoveryComposer
    class Engine < ::Rails::Engine
      engine_name "discovery_composer"
      isolate_namespace DiscoveryComposer
    end
  end

  DiscoveryComposer::Engine.routes.draw do
    post "determine-type" => "composer#determine_type"
    post "similar-title" => "composer#similar_title"
  end

  Discourse::Application.routes.append do
    mount ::DiscoveryComposer::Engine, at: "discovery"
  end

  class DiscoveryComposer::SimilarSerializer < ApplicationSerializer
    attributes :id, :title, :created_at, :url
  end

  require_dependency 'similar_topic_serializer'
  require_dependency "application_controller"
  class DiscoveryComposer::ComposerController < ::ApplicationController
    def determine_type
      title = params[:title]
      model = DiscourseMachineLearning::Model.new(TYPE_MODEL)
      type = model.eval(title)
      render json: success_json.merge(type: type)
    end

    def similar_title
      title = params[:title]
      categoryId = params[:categoryId]

      return [] unless title.present?

      topics = Topic.similar_title_to(title, categoryId, current_user).to_a
      render_serialized(topics, DiscoveryComposer::SimilarSerializer)
    end
  end

  require_dependency 'search'
  Topic.class_eval do
    def self.similar_title_to(title, categoryId, user=nil)
      filter_words = Search.prepare_data(title);
      ts_query = Search.ts_query(filter_words, nil, "|")

      candidates = Topic.visible
         .secured(Guardian.new(user))
         .listable_topics
         .joins('JOIN topic_search_data s ON topics.id = s.topic_id')
         .where("search_data @@ #{ts_query}")
         .order("ts_rank(search_data, #{ts_query}) DESC")
         .limit(SiteSetting.max_similar_results * 3)

      exclude_topic_ids = Category.pluck(:topic_id).compact!
      if exclude_topic_ids.present?
        candidates = candidates.where("topics.id NOT IN (?)", exclude_topic_ids)
      end

      if categoryId.present?
        candidates = candidates.where("topics.category_id = ?", categoryId)
      end

      candidate_ids = candidates.pluck(:id)

      return [] unless candidate_ids.present?

      similar = Topic.select(sanitize_sql_array(["topics.*, similarity(topics.title, :title) AS similarity, p.cooked as blurb", title: title]))
                       .joins("JOIN posts AS p ON p.topic_id = topics.id AND p.post_number = 1")
                       .limit(SiteSetting.max_similar_results)
                       .where("topics.id IN (?)", candidate_ids)
                       .where("similarity(topics.title, :title) > 0.2", title: title)
                       .order('similarity desc')
      similar
    end
  end

  require_dependency 'topic_subtype'
  class ::TopicSubtype
    def initialize(id, options)
      super
      SiteSetting.topic_types.each do |type|
        define_method "self.#{type}" do
          type
        end
        register type
      end
    end
  end

  require_dependency 'topic_view_serializer'
  class ::TopicViewSerializer
    attributes_from_topic :subtype
  end

  PostRevisor.track_topic_field(:topic_type)

  DiscourseEvent.on(:post_created) do |post, opts, user|
    topic_type = opts[:topic_type]
    if post.is_first_post? and topic_type
      topic = Topic.find(post.topic_id)
      if topic_type == 'wiki'
        post.wiki = true
        post.save!
      end
      topic.subtype = topic_type
      topic.save!
    end
  end
end
