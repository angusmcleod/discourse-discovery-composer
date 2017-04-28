import DiscoveryRoute from 'discourse/routes/discovery';
import TopicRoute from 'discourse/routes/topic';
import Composer from 'discourse/models/composer';
import { on } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'dc-route-edits',
  initialize(){
    DiscoveryRoute.reopen({
      disconnectComposer: function() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      },

      renderTemplate(controller, model) {
        this._super(controller, model);
        if (this.currentUser) {
          this.disconnectComposer();
        }
      },

      getController: function() {
        const path = window.location.pathname.split('/')[1];
        let controllerName = path === 'categories' ? "discovery/categories" : "discovery/topics";
        return this.controllerFor(controllerName);
      },

      openDiscoveryComposer: function() {
        const controller = this.getController();
        this.controllerFor('composer').open({
          categoryId: controller.get('category.id'),
          action: Composer.CREATE_TOPIC,
          draftKey: controller.get('model.draft_key'),
          draftSequence: controller.get('model.draft_sequence'),
          isDiscovery: true
        });
      },

      closeDiscoveryComposer: function() {
        const composer = this.controllerFor('composer');
        composer.set('model.isDiscovery', false);
        composer.shrink();
      },

      actions: {
        didTransition: function(transition) {
          this._super();
          if (this.currentUser) this.openDiscoveryComposer();
          return true;
        },

        willTransition: function(transition) {
          if (this.currentUser) {
            if (transition && transition.targetName.indexOf('discovery') > -1) {
              this.disconnectComposer();
            } else {
              this.closeDiscoveryComposer();
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {
            into: 'application',
            outlet: 'composer'
          })
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
}
