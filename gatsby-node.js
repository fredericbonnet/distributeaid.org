const slugify = require('slugify')
const path = require('path')
const PageTreeTraversal = require('./src/utils/PageTreeTraversal.js')
const { spawn } = require('child_process')

/*
Run Scripts After Build
================================================================================
*/
// exports.onCreateDevServer = async ({ reporter }) => {
//   const genTypes = await spawn('yarn', ['run', 'gen-types'], {
//     stdio: 'inherit',
//     shell: true,
//   })
//   genTypes.on('exit', (code) => {
//     if (code === 0) {
//       reporter.success(
//         'graphql-codegen: types generated from gatsby graphql endpoint',
//       )
//     } else {
//       reporter.error(`graphql-codegen: exited with code ${code}`)
//     }
//   })
// }

/*
Dynamic Pages
================================================================================
*/
exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions

  /*
  Site Metadata
  ------------------------------------------------------------
  */
  const metadataResult = await graphql(`
    {
      site {
        siteMetadata {
          domain
        }
        pathPrefix
      }
    }
  `)

  if (metadataResult.errors) {
    reporter.panicOnBuild(`
      Error while running GraphQL query to get
      the siteMetadata set in gatsby-config.js.
    `)
    return
  }

  /*
  Regions
  ------------------------------------------------------------ 
  */
  const regionsQuery = await graphql(`
    query RegionPagesQuery {
      regions: allMarkdownRemark(
        filter: {
          fileAbsolutePath: { glob: "**/content/pages/regions/*/index.md" }
        }
      ) {
        nodes {
          fileAbsolutePath
          frontmatter {
            name
            map
            overview
            governmentResponse
            newsUpdates {
              title
              visibleCount
              updates {
                title
                content
                date
                pinned
              }
            }
            subregions
          }
        }
      }
    }
  `)

  await Promise.all(
    regionsQuery.data.regions.nodes.map(async (regionNode) => {
      const subregionRelativePaths = regionNode.frontmatter.subregions.map(
        (subregionPath) => {
          return subregionPath.slice('content/pages/'.length)
        },
      )

      const subregionsQuery = await graphql(
        `
          query SubregionsQuery($subregionRelativePaths: [String]) {
            subregions: allFile(
              filter: { relativePath: { in: $subregionRelativePaths } }
            ) {
              nodes {
                id
                relativePath
                childMarkdownRemark {
                  frontmatter {
                    name
                    map
                    overview
                    population {
                      count
                      trend
                      description
                    }
                    stayInformed {
                      title
                      links {
                        label
                        url
                        description
                      }
                    }
                    newsUpdates {
                      title
                      visibleCount
                      updates {
                        title
                        content
                        date
                        pinned
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        { subregionRelativePaths: subregionRelativePaths },
      )

      const region = regionNode.frontmatter
      const slug = slugify(region.name, {
        lower: true,
        strict: true,
      })

      const subregions = subregionsQuery.data.subregions.nodes.map(
        ({ childMarkdownRemark: { frontmatter } }) => frontmatter,
      )

      console.log(`creating regions page at /routes/${slug}`)

      createPage({
        path: `/regions/${slug}`,
        component: path.resolve(`./src/templates/RegionPage.tsx`),
        context: {
          region: region,
          subregions: subregions,
        },
      })
    }),
  )

  /*
  Routes
  ------------------------------------------------------------
  For each page in the content/routes directory, we create a page using its path.
  */
  const routesQuery = await graphql(`
    query RoutePagesQuery {
      allFile(filter: { relativeDirectory: { eq: "routes" } }) {
        nodes {
          id
          childMarkdownRemark {
            frontmatter {
              pagePath
              routeOrigin
              routeDestination
              introduction
              mapUrl
              aidRequestFormUrl
              images {
                deliverySection
                reservationSection
                groupsSection
                storageSection
                palletsSection
              }
              costs {
                currency
                standardPaletteCost
                overflowPricing
                halfPaletteCost
              }
              deadlines {
                submissionsDeadline
                confirmationDate
                stagingBegins
                stagingEnds
                shipmentDeparture
              }
              frontlineGroups {
                logo
                name
              }
            }
          }
          relativeDirectory
        }
      }
    }
  `)

  routesQuery.data.allFile.nodes.forEach((route) => {
    if (route.childMarkdownRemark?.frontmatter) {
      console.log(
        `creating route page at /routes/${route.childMarkdownRemark.frontmatter.pagePath}`,
      )
      createPage({
        path: `/routes/${route.childMarkdownRemark.frontmatter.pagePath}`,
        component: path.resolve(`./src/templates/RoutePage.tsx`),
        context: {
          pageFields: route.childMarkdownRemark.frontmatter,
        },
      })
    }
  })
}

// https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html#manual-babel-setup
// This should really be handled by Gatsby but here we are
exports.onCreateBabelConfig = ({ actions }) => {
  actions.setBabelPlugin({
    name: '@babel/plugin-transform-react-jsx',
    options: {
      runtime: 'automatic',
    },
  })
}
