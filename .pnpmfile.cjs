module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@mento-protocol/mento-sdk") {
        pkg.peerDependencies = pkg.peerDependencies || {};
        if (pkg.peerDependencies.ethers) {
          pkg.peerDependencies.ethers = ">=5.8.0 <7";
        }
      }
      return pkg;
    },
  },
};
