var path = require('path');

var Db = function(options) {
    this.mongoose = options.mongoose;
    this.newId = id => new this.mongoose.Types.ObjectId(id || void(0))

    if(toString.call(options.models) == "[object String]") {
        this.models = require('require-all')({
            dirname: options.models
        });
    }else{
        var models = options.models
    }
};


hasRights = function hasRights(req, doc) {
    "use strict";
    return doc.userId!== req.user._id.toString()
}

function create(req, res, next){
    var element = new this(req.body);
    element.userId = req.user._id;
    element.save(function(err, el){
        if(err) next(err);
        res.send(el);
    })
};

function remove(req, res, next){
    var col = this;
    this.findById(req.params.id,function(err, doc){
        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(hasRights(req, doc)){
            if(col.schema.tree.state){
                doc.state = 'deleted';
                doc.save();
            }else{
                doc.remove()
            }
            res.send('ok');
        }else{
            var error = new Error('У вас нет прав на эту операцию');
            error.status = '403';
            next(error);
        }
    });


};

function patch(req, res, next) {
    var data = req.body;
    var userId = req.user._id;

    if(Object.keys(data).length > 1) {
        next(new Error("Методом PATCH можно передать только одну пару знанчений"))
        return false;
    }

    this.findOne({_id: req.params.id}, function(err, doc) {

        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(hasRights(req, doc)){
            Object.assign(doc, data);
            doc.save(function(err, doc){
                if(err) {next(err); return false}
                var json = doc.toObject({transform: true, virtuals: true, patch: true, isOwner: userId && userId.equals(doc.userId)});
                for(var key in data){
                    if(data.hasOwnProperty(key)) {
                        data[key] = json[key] || {};
                    }
                }

                res.send(data)
            })
        }else{
            var error = new Error('У вас нет прав на эту операцию');
            error.status = 403;
            next(error);
        }
    });


};

function update(req, res, next){

    var el = req.body;
    delete el._id;

    if(!req.params.id) next(new Error('Common update module. Params does not have id'));
    else{
        this.findById(req.params.id, function(err, doc){
            if(err) next(err);
            else if(!doc){
                next(new Error("Документ не найден"))
            }else if(hasRights(req, doc)){
                Object.assign(doc, el);
                doc.save(function(err, d) {
                    "use strict";
                    res.send(el)
                })
            }else{
                var error = new Error('У вас нет прав на эту операцию');
                error.status = 403;
                next(error);
            }
        })
    }
};


function read(req, res, next){

    var data = req.query;
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

};

function rout(req, res, next){

    switch (req.method){
        case 'GET':
            read.apply(this, arguments);
            break;
        case 'DELETE':
            remove.apply(this, arguments);
            break;
        case 'POST':
            create.apply(this, arguments);
            break;
        case 'PUT':
            update.apply(this, arguments);
            break;
        case 'PATCH':
            patch.apply(this, arguments);
    }
}

Db.prototype.middleware = function() {
    var self = this;
    var models = this.models

    return function(req, res, next) {
        var model = models[req.params.model];
        rout.apply(model, arguments);
    }
}

module.exports  = Db;

