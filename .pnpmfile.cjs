module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@mento-protocol/mento-sdk") {
        pkg.dependencies = pkg.dependencies || {};
        if (!pkg.dependencies.ethers) {
          pkg.dependencies.ethers = "5.8.0";
        }
      }
      return pkg;
    },
  },
};
