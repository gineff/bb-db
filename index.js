/**
 * Created by Андрей on 18.04.2016.
 */


/**
 * Created by Андрей on 24.02.2016.
 */

var when = require('when');
var _ = require('underscore');

var Db = function(options) {
    this.mongoose = options.mongoose;
    this.newId = id => new this.mongoose.Types.ObjectId(id || void(0))

    if(toString.call(options.models) == "[object String]") {
        this.models = require('require-all')({
            dirname: __dirname +'../'+ options.models,
            resolve: function(model) {
                return model.module;
            }
        });
    }else{
        var models = options.models
    }
};





Db.hasRights = function(req, doc) {
    "use strict";
    return doc.userId!== req.user._id.toString()
}

Db.prototype.create = function(req, res, next){
    var element = new this.collection(req.body);
    element.userId = req.user._id;
    element.save(function(err, el){
        if(err) next(err);
        res.send(el);
    })
};

Db.prototype.delete = function(req, res, next){
    var col = this.collection;
    this.collection.findById(req.params.id,function(err, doc){
        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(Db.hasRights(req, doc)){
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

Db.prototype.patch = function(req, res, next) {
    var data = req.body;
    var userId = req.user._id;

    if(Object.keys(data).length > 1) {
        next(new Error("Методом PATCH можно передать только одну пару знанчений"))
        return false;
    }

    this.collection.findOne({_id: req.params.id}, function(err, doc) {

        if(err) next(err);
        else if(!doc){
            next(new Error("Документ не найден"))
        }else if(Db.hasRights(req, doc)){
            _.extend(doc, data);
            doc.save(function(err, doc){
                if(err) {next(err); return false}
                var json = doc.toObject({transform: true, virtuals: true, patch: true, isOwner: userId.equals(doc.userId)});
                _.each(data, (val, key)=>{
                    data[key] = json[key] || {};
                });

                res.send(data)
            })
        }else{
            var error = new Error('У вас нет прав на эту операцию');
            error.status = 403;
            next(error);
        }
    });


};

Db.prototype.update = function(req, res, next){

    var el = req.body;
    delete el._id;


    if(!req.params.id) next(new Error('Common update module. Params does not have id'));
    else{
        this.collection.findById(req.params.id, function(err, doc){
            if(err) next(err);
            else if(!doc){
                next(new Error("Документ не найден"))
            }else if(Db.hasRights(req, doc)){
                _.extend(doc, el);
                debugger;
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


Db.prototype.read = function(req, res, next){

    var data = req.query;
    var userId = req.user && req.user._id;

    var refine = data.options && data.options.refine;

    if(req.params.id){
        this.collection.findById(req.params.id, null, data.options).exec(function (err, doc) {
            "use strict";
            if(err) next(err);
            else if(!doc) {
                next(new Error("Документ не найден"))
            }else if(doc.state && doc.state == 'deleted') {
                next(new Error('Документ не найден'))
            }else{
                res.send(doc.toObject({transform: true, virtuals: true, isOwner: userId.equals(doc.userId), refine: refine}))
            }
        })
    }else{

        if(data.query){
            this.collection.find(data.query, null, data.options).exec(function (err, docs) {
                if(err) next(err);
                else{
                    res.send(_.map(docs, (doc)=> doc.toObject({
                        transform: true,
                        virtuals: true,
                        isOwner: userId.equals(doc.userId),
                        refine: refine
                    })))
                }
            })
        }else{
            data.aggregate = data.aggregate || [];

            if( Object.prototype.toString.call( data.aggregate ) !== '[object Array]' ) {
                data.aggregate = [data.aggregate];
            }

            //     data.aggregate.unshift({$match:{userId:userId.toHexString()}});

            console.log(data.aggregate)
            this.collection.aggregate(data.aggregate).exec(function (err, docs) {
                if(err) next(err);
                else res.send(docs)
            })

        }

    }





};


Db.prototype.parse = function(obj){

    function getNode(el){
        for(var key in el){
            if ( !el.hasOwnProperty(key) ) continue;

            if(el[key].$date){ el.key = new Date(el[key].$date)}
            else if(el[key].$objectId){ el[key] =  Db.prototype.newId(el[key].$objectId);}
            else if(typeof el[key] == 'object'){
                getNode(el[key]);
            }else{
                if(el[key] == +el[key]) el[key] = +el[key];
            }
        }
        return el;
    }

    getNode(obj);
    return obj;

};

Db.prototype.rout = function(req, res, next){
    switch (req.method){
        case 'GET':
            this.read.apply(this, arguments);
            break;
        case 'DELETE':
            this.delete.apply(this, arguments);
            break;
        case 'POST':
            this.create.apply(this, arguments);
            break;
        case 'PUT':
            this.update.apply(this, arguments);
            break;
        case 'PATCH':
            this.patch.apply(this, arguments);
    }
}



module.exports  = Db;

