const gulp = require("gulp");
const clean = require("gulp-clean");
const ts = require("gulp-typescript");
const nodemon = require("gulp-nodemon");

const tsProject = ts.createProject("tsconfig.json");

const cleanTask = () => {
  return gulp.src("dist", { allowEmpty: true }).pipe(clean());
};
const static = gulp.series(cleanTask, () => {
  return gulp
    .src(["src/**/*.json"], { allowEmpty: true })
    .pipe(gulp.dest("dist"));
});

const scripts = gulp.series(static, () => {
  const tsResult = tsProject.src().pipe(tsProject());
  return tsResult.js.pipe(gulp.dest("dist"));
});

const taskNodemon = function(done) {
  const STARTUP_TIMEOUT = 5000;
  const server = nodemon({
    script: "dist/index.js",
    watch: ["dist"],
    stdout: false // without this line the stdout event won't fire
  });
  let starting = false;

  const onReady = () => {
    starting = false;
    done();
  };

  server.on("start", () => {
    starting = true;
    setTimeout(onReady, STARTUP_TIMEOUT);
  });

  server.on("stdout", stdout => {
    process.stdout.write(stdout); // pass the stdout through
    if (starting) {
      onReady();
    }
  });
};

const watch = gulp.series(scripts, taskNodemon, () => {
  return gulp.watch(["src/**/*.ts", "src/**/*.json"], scripts);
});

gulp.task("default", watch);
