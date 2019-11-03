import { Transaction } from "sequelize";
import { DbConnection } from "../../../interfaces/DbConnectionInterface";
import { GraphQLResolveInfo } from "graphql";
import { CommentInstance } from "../../../models/CommentModel";
import { handleError, throwError } from "../../../utils/utils";
import { compose } from "../../composable/composable.resolver";
import { authResolvers } from "../../composable/auth.resolver";
import { AuthUser } from "../../../interfaces/AuthUserInterface";
import { DataLoaders } from "../../../interfaces/DataLoadersInterface";

export const commentResolvers = {
  Comment: {
    user: (
      parent,
      params,
      {
        db,
        dataloaders: { userLoader }
      }: { db: DbConnection; dataloaders: DataLoaders },
      info: GraphQLResolveInfo
    ) => {
      return userLoader
        .load({ key: parent.get("user"), info })
        .catch(handleError);
    },
    post: (
      comment,
      params,
      {
        db,
        dataloaders: { postLoader }
      }: { db: DbConnection; dataloaders: DataLoaders },
      info: GraphQLResolveInfo
    ) => {
      return postLoader
        .load({ key: comment.get("post"), info })
        .catch(handleError);
    }
  },

  Query: {
    commentsByPost: (
      parent,
      { postId, first = 10, offset = 0 },
      context,
      info: GraphQLResolveInfo
    ) => {
      postId = parseInt(postId);
      return context.db.Comment.findAll({
        where: {
          post: postId
        },
        limit: first,
        offset,
        attributes: context.requestedFields.getFields(info)
      }).catch(handleError);
    }
  },
  Mutation: {
    createComment: compose(...authResolvers)(
      (
        parent,
        { input },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        input.user = authUser.id;
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Comment.create(input, { transaction: t });
          })
          .catch(handleError);
      }
    ),
    updateComment: compose(...authResolvers)(
      (
        parent,
        { id, input },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        input.user = authUser.id;
        id = parseInt(id);
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Comment.findById(id).then((comment: CommentInstance) => {
              throwError(!comment, `Comment with id ${id} not fount!`);
              throwError(
                comment.get("user") != authUser.id,
                `Unauthorized! You can only edit comments by yourself!`
              );
              return comment.update(input, { transaction: t });
            });
          })
          .catch(handleError);
      }
    ),
    deleteComment: compose(...authResolvers)(
      (
        parent,
        { id },
        { db, authUser }: { db: DbConnection; authUser: AuthUser },
        info: GraphQLResolveInfo
      ) => {
        id = parseInt(id);
        return db.sequelize
          .transaction((t: Transaction) => {
            return db.Comment.findById(id).then((comment: CommentInstance) => {
              throwError(!comment, `Comment with id ${id} not fount!`);
              throwError(
                comment.get("user") != authUser.id,
                `Unauthorized! You can only delete comments by yourself!`
              );
              return comment
                .destroy({ transaction: t })
                .then(comment => !!comment);
            });
          })
          .catch(handleError);
      }
    )
  }
};
