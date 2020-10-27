import { isAuth } from "../middlewares/isAuth";
import { MyContext } from "src/types";
import {
    Arg,
    Ctx,
    Field,
    FieldResolver,
    InputType,
    Int,
    Mutation,
    ObjectType,
    Query,
    Resolver,
    Root,
    UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";

@InputType()
class PostInput {
    @Field()
    title: string;
    @Field()
    text: string;
}

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[];

    @Field()
    hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
    @FieldResolver(() => String)
    textSnippet(@Root() root: Post) {
        return root.text.slice(0, 50);
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg("postId", () => Int) postId: number,
        @Arg("value", () => Int) value: number,
        @Ctx() { req }: MyContext
    ) {
        const isUpdoot = value !== -1;
        const _value = isUpdoot ? 1 : -1;
        const { userId } = req.session;

        const updoot = await Updoot.findOne({ where: { postId, userId } });

        // the user voted on the post
        // and chaning their vote
        if (updoot && updoot.value !== _value) {
            await getConnection().transaction(async (tm) => {
                await tm.query(
                    `UPDATE updoot SET value = $1 WHERE "postId" = $2 and "userId" = $3`,
                    [_value, postId, userId]
                );
                await tm.query(
                    `UPDATE post SET points = points + $1 WHERE id = $2`,
                    [2 * _value, postId]
                );
            });
        } else if (!updoot) {
            // has never voted before
            await getConnection().transaction(async (tm) => {
                await tm.query(
                    `INSERT INTO updoot ("userId", "postId", "value")VALUES ($1, $2, $3)`,
                    [userId, postId, _value]
                );
                await tm.query(
                    `UPDATE post SET points = points + $1 WHERE id = $2`,
                    [_value, postId]
                );
            });
        }

        return true;
    }

    @Query(() => PaginatedPosts)
    async posts(
        @Arg("limit", () => Int) limit: number,
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null
        @Ctx() {req}: MyContext
    ): Promise<PaginatedPosts> {
        const realLimit = Math.min(50, limit);
        const realLimitPlusOne = realLimit + 1;

        const replacements: any = [realLimitPlusOne, req.session.userId];

        if (cursor) {
            replacements.push(new Date(parseInt(cursor)));
        }

        const posts = await getConnection().query(
            `
            SELECT p.*, 
            json_build_object(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'createdAt', u."createdAt",
                'updatedAt', u."updatedAt"
            ) creator,
            ${
                req.session.userId 
                    ? '(SELECT value FROM updoot WHERE "userId" = $2 and "postId" = p.id) "voteStatus"' 
                    : '$2 as "voteStatus"'
            }
            FROM post p
            INNER JOIN public.user u ON u.id = p."creatorId"
            ${cursor ? `WHERE p."createdAt" < $3` : ""}
            ORDER BY p."createdAt" DESC
            LIMIT $1
        `,
            replacements
        );

        return {
            posts: posts.slice(0, realLimit),
            hasMore: posts.length === realLimitPlusOne,
        };
    }

    @Query(() => Post, { nullable: true })
    post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
        return Post.findOne(id, {relations: ['creator']});
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg("input") input: PostInput,
        @Ctx() { req }: MyContext
    ): Promise<Post> {
        return Post.create({ ...input, creatorId: req.session.userId }).save();
    }

    @Mutation(() => Post, { nullable: true })
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg("id") id: number,
        @Arg("title", () => String, { nullable: true }) title: string
    ): Promise<Post | null> {
        const post = await Post.findOne(id);

        if (!post) {
            return null;
        }

        if (typeof title !== "undefined") {
            await Post.update({ id }, { title });
        }

        return post;
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async deletePost(@Arg("id") id: number): Promise<boolean> {
        await Post.delete(id);
        return true;
    }
}
