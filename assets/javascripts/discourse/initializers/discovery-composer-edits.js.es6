import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import ComposerTitle from 'discourse/components/composer-title';
import ComposerMessages from 'discourse/components/composer-messages';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import DiscoveryRoute from 'discourse/routes/application';
import TopicRoute from 'discourse/routes/topic';
import TopicAdapter from 'discourse/adapters/topic';
import { ajax } from 'discourse/lib/ajax';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { getOwner } from 'discourse-common/lib/get-owner';

const discoveryComposeStates = {
  discoveryInitial: () => {
    $('#reply-control').find('.reply-to, .topic-type-choice, .wmd-controls, .submit-panel').hide();
    $('#reply-control').css('height', '48px');
  },
  discoveryInput: () => {
    $('#reply-control').find('.input-tip').show();
    $('#reply-control').css('height', '75px');
  },
  discoverySimilar: () => {
    $('#reply-control').css('height', $('.similar-title-topics').height() + 70);
  },
  discoveryFull: () => {
    $('#reply-control').css('height', '400px');
    $('#reply-control').find('.wmd-controls').show();
    Ember.run.later((function() {
      $('#reply-control').find('.submit-panel').show();
    }), 300);
  },
  discoveryTypes: () => {
    $('#reply-control').find('.topic-type-choice').show();
    $('#reply-control').css('height', '90px');
  }
}

export default {
  name: 'discovery-composer',
  initialize(){

    Composer.reopen({
      showCategoryChooser: false,
      similarTitleTopics: Ember.A(),

      @computed('composeState')
      isDiscovery: function() {
        return this.get('composeState').indexOf('discovery') > -1;
      },

      @computed('composeState')
      viewOpen: function() {
        return this.get('composeState') === 'open' ||
               this.get('isDiscovery')
      }
    })

    ComposerController.reopen({
      _setModel(composerModel, opts) {
        this.set('linkLookup', null);

        if (opts.draft) {
          composerModel = loadDraft(this.store, opts);
          if (composerModel) {
            composerModel.set('topic', opts.topic);
          }
        } else {
          composerModel = composerModel || this.store.createRecord('composer');
          composerModel.open(opts);
        }

        this.set('model', composerModel);
        composerModel.set('isWarning', false);

        if (opts.topicTitle && opts.topicTitle.length <= this.siteSettings.max_topic_title_length) {
          this.set('model.title', opts.topicTitle);
        }

        if (opts.topicCategoryId) {
          this.set('model.categoryId', opts.topicCategoryId);
        } else if (opts.topicCategory) {
          const splitCategory = opts.topicCategory.split("/");
          let category;

          if (!splitCategory[1]) {
            category = this.site.get('categories').findBy('nameLower', splitCategory[0].toLowerCase());
          } else {
            const categories = Discourse.Category.list();
            const mainCategory = categories.findBy('nameLower', splitCategory[0].toLowerCase());
            category = categories.find(function(item) {
              return item && item.get('nameLower') === splitCategory[1].toLowerCase() && item.get('parent_category_id') === mainCategory.id;
            });
          }

          if (category) {
            this.set('model.categoryId', category.get('id'));
          }
        }

        if (opts.topicTags && !this.site.mobileView && this.site.get('can_tag_topics')) {
          this.set('model.tags', opts.topicTags.split(","));
        }

        if (opts.topicBody) {
          this.set('model.reply', opts.topicBody);
        }
      }
    })

    ComposerTitle.reopen({
      @on('didInsertElement')
      setupProcessTitle() {
        $('#reply-title').on('keydown', Ember.run.bind(this, this.processTitle));
      },

      processTitle(event) {
        if (event.keyCode === 13) {
          if (this.get('validation')) {
            this.set('validation.lastShownAt', true)
          } else {
            this.appEvents.trigger("composer:valid-title");
          }
        }
      },

      @on('willDestroy')
      destroyProcessTitle() {
        $('#reply-title').off('keydown', Ember.run.bind(this, this.processTitle));
      }
    })

    ComposerMessages.reopen({
      _lastTitleSimilaritySearch: null,

      @on('didInsertElement')
      watchValidTitle() {
        this.appEvents.on('composer:valid-title', this, this._handleValidTitle);
      },

      @on('willDestroyElement')
      destroyValidTitle() {
        this.appEvents.off('composer:valid-title', this, this._handleValidTitle);
      },

      _handleValidTitle() {
        const composer = this.get('composer');

        // We don't care about similar topics unless creating a topic
        if (!composer.get('creatingTopic')) { return; }

        const title = composer.get('title') || '';
        const categoryId = composer.get('categoryId') || '';

        // Ensure the fields are of the minimum length
        if (title.length < Discourse.SiteSettings.min_title_similar_length) { return; }

        // Don't search over and over
        if (title === this._lastTitleSimilaritySearch) { return; }
        this._lastTitleSimilaritySearch = title;

        const similarTitleTopics = composer.get('similarTitleTopics');

        composer.store.find('similar-topic', {title, categoryId}).then(newTopics => {
          similarTitleTopics.clear();
          similarTitleTopics.pushObjects(newTopics.get('content'));

          if (similarTitleTopics.get('length') > 0) {
            composer.set('composeState', 'discoverySimilar');
          } else {
            this.appEvents.trigger('composer:accept-title');
          }
        });
      }
    })

    ComposerBody.reopen({
      titleValid: false,

      @on('init')
      @observes('composer.isDiscovery,composer.similarTitleTopics.[]')
      handleComposeState() {
        if (this.get('composer.isDiscovery')) {
          Ember.run.scheduleOnce('afterRender', this, function() {
            discoveryComposeStates[this.get('composer.composeState')]()
          })
        }
      },

      @on('didInsertElement')
      @observes('composer.isDiscovery')
      showHideComposeBody() {
        if (this.get('composer.isDiscovery')) {
          $(document).on('click', Ember.run.bind(this, this.handleClick));
          $(document).on('resize', Ember.run.bind(this, this.handleWindowResize));
          this.appEvents.on('composer:accept-title', this, this.handleAcceptTitle);
        }
      },

      @on('didInsertElement')
      @observes('composer.isDiscovery')
      destroyExpandEvent() {
        $(document).off('click', Ember.run.bind(this, this.handleClick));
        $(document).off('resize', Ember.run.bind(this, this.handleResize));
      },

      handleClick(event) {
        if (event.target.id === 'reply-title' && this.get('composer.composeState') === 'discoveryInitial') {
          this.set('composer.composeState', 'discoveryInput');
        }
        if (!$(event.target).closest(this.$()).length) {
          this.set('composer.composeState', 'discoveryInitial');
        }
      },

      handleWindowResize(event) {
        let titleWidth = $('.title-input').width() - 21;
        $('#reply-title').css('width', `${titleWidth}px`)
      },

      handleAcceptTitle(event) {
        this.set('composer.composeState', 'discoveryFull');;
      }
    })

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

    DiscoveryRoute.reopen({
      firstRenderDiscovery: false,
      transitionToDiscovery: false,

      disconnectComposer: function() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      },

      isDiscoveryPath: function() {
        const pathSlug = window.location.pathname.split('/')[1];
        const filters = Discourse.Site.currentProp('filters');
        let filterPath = pathSlug === '' || filters.filter(function(filter) {
                           return pathSlug === filter;
                         }).length > 0;
        let categoryPath = pathSlug === 'c';
        let categoriesPath = pathSlug === 'categories';
        return filterPath || categoryPath || categoriesPath
      },

      renderTemplate(controller, model) {
        this._super();
        if (this.currentUser && this.isDiscoveryPath()) {
          this.disconnectComposer();
          this.set('firstRenderDiscovery', true)
        }
      },

      actions: {

        didTransition: function() {
          this._super();
          if (this.currentUser && (this.get('firstRenderDiscovery') || this.get('transitionToDiscovery'))) {
            const controller = this.controllerFor("discovery/topics")
            this.controllerFor('composer').open({
              categoryId: controller.get('category.id'),
              action: Composer.CREATE_TOPIC,
              draftKey: controller.get('model.draft_key'),
              draftSequence: controller.get('model.draft_sequence'),
              composerState: 'discoveryInitial'
            });
            this.setProperties({
              'firstRenderDiscovery': false,
              'transitionToDiscovery': false
            })
          }
          return true; // Bubble the didTransition event
        },

        willTransition: function(transition) {
          if (this.currentUser) {
            if (transition.targetName.indexOf('discovery') > -1) {
              this.disconnectComposer();
              this.set('transitionToDiscovery', true)
            } else {
              const composer = getOwner(this).lookup('model:composer');
              composer.set('isDiscovery', false);
              this.controllerFor('composer').shrink();
              this.set('transitionToDiscovery', false)
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {into: 'application', outlet: 'composer'})
        }
      },

      @on('deactivate')
      removeComposer() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      }
    })
  }
};
