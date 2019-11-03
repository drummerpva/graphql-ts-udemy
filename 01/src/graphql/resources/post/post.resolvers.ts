import { GraphQLResolveInfo } from "graphql";
import { DbConnection } from "../../../interfaces/DbConnectionInterface";
import * as graphqlFields from "graphql-fields";

import { PostInstance } from "../../../models/PostModel";
import { Transaction } from "sequelize";
import { handleError, throwError } from "../../../utils/utils";
import { compose } from "../../composable/composable.resolver";
import { authResolvers } from "../../composable/auth.resolver";
import { AuthUser } from "../../../interfaces/AuthUserInterface";
import { DataLoaders } from "../../../interfaces/DataLoadersInterface";

export const postResolvers = {
  Post: {
    author: (
      parent,
      params,
      {
        db,
        dataloaders: { userLoader }
      }: { db: DbConnection; dataloaders: DataLoaders },
      info: GraphQLResolveInfo
    ) => {
      return userLoader
        .load({ key: parent.get("author"), info })
        .catch(handleError);
    },
    comments: (
      parent,
      { first = 10, offset = 0 },
      context,
      info: GraphQLResolveInfo
    ) => {
      return context.db.Comment.findAll({
        where: { post: parent.get("id") },
        limit: first,
        offset,
        attributes: context.requestedFields.getFields(info)
      }).catch(handleError);
    }
  },

  Query: {
    posts: (
      parent,
      { first = 10, offset = 0 },
      context,
      info: GraphQLResolveInfo
    ) => {
      return context.db.Post.findAll({
        limit: first,
        offset,
        attributes: context.requestedFields.getFields(info, {
          keep: ["id"],
          exclude: ["comments"]
        })
      }).catch(handleError);
    },
    post: (parent, { id }, context, info: GraphQLResolveInfo) => {
      id = parseInt(id);
      return context.db.Post.findById(id, {
        attributes: context.requestedFields.getFields(info, {
          keep: ["id"],
          exclude: ["comments"]
        })
      })
        .then((post: PostInstance) => {
          throwError(!post, `Post with id ${id} not found!`);
          return post;
        })
        .catch(handleError);
    }
  },
  Mutation: {
    createPost: compose(...authResolvers)(
      (
        parent,
        { input },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        input.author = authUser.id;
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Post.create(input, { transaction: t });
          })
          .catch(handleError);
      }
    ),
    updatePost: compose(...authResolvers)(
      (
        parent,
        { id, input },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        input.author = authUser.id;
        id = parseInt(id);
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Post.findById(id).then((post: PostInstance) => {
              throwError(!post, `Post with id ${id} not found!`);
              throwError(
                post.get("author") != authUser.id,
                `Unauthorized! You can only edit posts by yourself`
              );
              return post.update(input, { transaction: t });
            });
          })
          .catch(handleError);
      }
    ),
    deletePost: compose(...authResolvers)(
      (
        parent,
        { id },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        id = parseInt(id);
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Post.findById(id).then((post: PostInstance) => {
              throwError(!post, `Post with id ${id} not found!`);
              throwError(
                post.get("author") != authUser.id,
                `Unauthorized! You can only delete posts by yourself`
              );
              return post.destroy({ transaction: t }).then(post => !!post);
            });
          })
          .catch(handleError);
      }
    )
  }
};
