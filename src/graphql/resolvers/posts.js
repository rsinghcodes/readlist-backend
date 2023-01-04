const marked = require('marked');
const slugify = require('slugify');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { GraphQLError } = require('graphql');
const dompurify = createDomPurify(new JSDOM().window);

const { validatePostInput } = require('../../utils/validators');
const Post = require('../../models/Post');
const checkAuth = require('../../utils/check-auth');

module.exports = {
  Query: {
    async getPosts() {
      try {
        const posts = await Post.find().sort({ createdAt: -1 });
        return posts;
      } catch (err) {
        throw new Error(err);
      }
    },
    async getPost(_, { slug }) {
      try {
        const post = await Post.findOne({ slug });

        if (post) {
          return post;
        } else {
          throw new Error('Post not found');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async searchPost(_, { filter }) {
      let searchQuery = {};

      // run if search is provided
      if (filter) {
        // update the search query
        searchQuery = {
          $or: [
            { title: { $regex: filter, $options: 'i' } },
            { desc: { $regex: filter, $options: 'i' } },
          ],
        };
      }
      try {
        const post = await Post.find(searchQuery);

        if (post) {
          return post;
        } else {
          throw new Error('Post not found');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async getPostforUpdate(_, { postId }) {
      try {
        const post = await Post.findById(postId);

        if (post) {
          return post;
        } else {
          throw new Error('Post not found');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async getUserPosts(_, { userId }) {
      try {
        const post = await Post.find({ user: userId }).sort({ createdAt: -1 });

        if (post) {
          return post;
        } else {
          throw new Error('Post not found');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
  },
  Mutation: {
    async createPost(_, { title, desc, body }, context) {
      const user = checkAuth(context);

      const { errors, isValid } = validatePostInput(title, desc, body);

      if (!isValid) {
        throw new GraphQLError('Errors', {
          extensions: { code: 'BAD_USER_INPUT', errors },
        });
      }

      // Make sure same title doesn't already exist
      const blogTitle = await Post.findOne({ title });
      if (blogTitle) {
        throw new GraphQLError('Title is taken', {
          extensions: {
            code: 'GRAPHQL_VALIDATION_FAILED',
            errors: {
              title: 'This title is already taken.',
            },
          },
        });
      }

      const newPost = new Post({
        title,
        slug: slugify(title, { lower: true, strict: true }),
        desc,
        body,
        sanitizedHtml: dompurify.sanitize(marked.parse(body)),
        user: user.id,
        email: user.email,
        fullname: user.fullname,
        createdAt: new Date().toISOString(),
      });

      const post = await newPost.save();

      return post;
    },
    async updatePost(_, { postId, title, desc, body }, context) {
      const user = checkAuth(context);

      const { errors, isValid } = validatePostInput(title, desc, body);

      if (!isValid) {
        throw new GraphQLError('Errors', {
          extensions: { code: 'BAD_USER_INPUT', errors },
        });
      }

      try {
        const post = await Post.findById(postId);
        if (user.email === post.email) {
          const updatedPost = await Post.findByIdAndUpdate(
            postId,
            {
              title,
              slug: slugify(title, { lower: true, strict: true }),
              desc,
              body,
              sanitizedHtml: dompurify.sanitize(marked.parse(body)),
            },
            { new: true }
          );

          return updatedPost;
        } else {
          throw new GraphQLError('Action not allowed', {
            extensions: { code: 'AUTHENTICATION_ERROR' },
          });
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async deletePost(_, { postId }, context) {
      const user = checkAuth(context);

      try {
        const post = await Post.findById(postId);
        if (user.email === post.email) {
          await post.delete();
          return 'Post deleted successfully';
        } else {
          throw new GraphQLError('Action not allowed', {
            extensions: { code: 'AUTHENTICATION_ERROR' },
          });
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async likePost(_, { postId }, context) {
      const { email } = checkAuth(context);

      const post = await Post.findById(postId);
      if (post) {
        if (post.likes.find((like) => like.email === email)) {
          post.likes = post.likes.filter((like) => like.email !== email);
        } else {
          post.likes.push({
            email,
            createdAt: new Date().toISOString(),
          });
        }

        await post.save();
        return post;
      } else
        throw new GraphQLError('Post not found', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
    },
  },
};
