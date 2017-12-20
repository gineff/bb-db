var express = require('express');
var router = express.Router();
var EventEmitter = require('events');


var methods = {GET: 'read', POST: 'create', PUT: 'update', DELETE: 'remove', PATCH: 'patch'};
var extention = {read, remove, create, update, patch};

var Db = function(options) {
    var models;

    if(toString.call(options.models) == "[object String]") {
        models = require('require-all')({
            dirname: options.models
        });
    }else{
        models = options.models
    }
    var emitter = options.emitter || new EventEmitter();
        
    for(var key in models) {
        if(models.hasOwnProperty(key)) {
            Object.assign(models[key], {hasRights, emitter});
        }
    }
    
    return router.all('/:model/:id?', function (req, res, next) {
        var model = models[req.params.model];
        if(!model) next(new Error(`Model '${req.params.model}' not found`));
			extention[methods[req.method]].call(model, req, res, next);
    });
};


function hasRights(req, doc) {
    return !this.schema.tree.userId || doc.userId && doc.userId!== req.user._id.toString()
}

function create(req, res, next){
    var element = new this(req.body);
    if(this.schema.tree.userId){
        element.userId = req.user._id;
        //if(!this.hasRights()) return next(new Error('Требуется авторизация'));
    }

    element.save(function(err, el){
        if(err) next(err);
        //this.emitter.emit('bb-db:created', this.collection.NativeCollection.name, el)
        res.send(el);
    })
}

function remove(req, res, next){
    var col = this;
    this.findById(req.params.id, function(err, doc){
        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(col.hasRights(req, doc)){
            if(col.schema.tree.state){
                doc.state = 'deleted';
                doc.save();
            }else{
                col.emitter.emit('bb-db:removed', this.collection.NativeCollection.name, req.params.id);
                doc.remove()
            }
            res.send('ok');
        }else{
            var error = new Error('У вас нет прав на эту операцию');
            error.status = '403';
            next(error);
        }
    });
}

function patch(req, res, next) {
    var data = req.body;
    var userId = req.user._id;
    var col = this;
    if(Object.keys(data).length > 1) {
        next(new Error("Методом PATCH можно передать только одну пару знанчений"));
        return false;
    }

    this.findOne({_id: req.params.id}, function(err, doc) {

        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(col.hasRights(req, doc)){
            Object.assign(doc, data);
            doc.save(function(err, doc){
                if(err) {next(err); return false}
                var json = doc.toObject({transform: true, virtuals: true, patch: true, isOwner: userId && userId.equals(doc.userId)});
                for(var key in data){
                    if(data.hasOwnProperty(key)) {
                        data[key] = json[key] || {};
                    }
                }
                col.emitter.emit('bb-db:patched', this.collection.NativeCollection.name, req.params.id);
                res.send(data)
            })
        }else{
            var error = new Error('У вас нет прав на эту операцию');
            error.status = 403;
            next(error);
        }
    });
}

function update(req, res, next){

    var el = req.body;
    delete el._id;
    var col = this;
    if(!req.params.id) next(new Error('Common update module. Params does not have id'));
    else{
        this.findById(req.params.id, function(err, doc){
            if(err) next(err);
            else if(!doc){
                next(new Error("Документ не найден"))
            }else if(col.hasRights(req, doc)){
                Object.assign(doc, el);
                doc.save(function(err, d) {
                    "use strict";
                    col.emitter.emit('bb-db:updated', this.collection.NativeCollection.name, req.params.id);
                    res.send(el)
                })
            }else{
                var error = new Error('У вас нет прав на эту операцию');
                error.status = 403;
                next(error);
            }
        })
    }
}


function read(req, res, next){

    var query = req.query;
    var data = (typeof query.data === 'string')? JSON.parse(query.data) : query.data;
    var userId = req.user && req.user._id;

    var refine = data.options && data.options.refine;

    if(req.params.id){
        this.findById(req.params.id, null, data.options).exec(function (err, doc) {
            "use strict";
            if(err) next(err);
            else if(!doc) {
                next(new Error("Документ не найден"))
            }else if(doc.state && doc.state == 'deleted') {
                next(new Error('Документ не найден'))
            }else{
                res.send(doc.toObject({transform: true, virtuals: true, isOwner: userId && userId.equals(doc.userId), refine: refine}))
            }
        })
    }else{

    data.query = data.query || {};

        data.query.state = data.query.state || {$ne: 'deleted'};
        this.find(data.query, null, data.options).exec(function (err, docs) {
            if(err) next(err);
            else{
                res.send(
                    docs.map(doc => doc.toObject({
                         transform: true,
                         virtuals: true,
                         isOwner: userId && userId.equals(doc.userId),
                         refine: refine
                    }))
                )
            }
        })
    }

}

module.exports  = Db;
