var gulp = require('gulp'),
    less = require('gulp-less'),
    path = require('path'),
    app_directory = 'app',
    del = require('del');

gulp.task('delete-css', function () {
    return del([
        app_directory+'/static/app/style/css'
    ]);
});

gulp.task('less-compile',['delete-css'],function () {
    return gulp.src(app_directory+'/UI/app/style/**/*.less')
        .pipe(less())
        .pipe(gulp.dest(app_directory+'/static/app/style/'));
});

gulp.task('copy-partials', function(){
    return gulp.src(app_directory+'/UI/app/partials/**/*.html')
        .pipe(gulp.dest(app_directory+'/static/app/partials'));
});

gulp.task('copy-js', function(){
    return gulp.src(app_directory+'/UI/app/js/**/*.js')
        .pipe(gulp.dest(app_directory+'/static/app/js'));
});

gulp.task('copy-app-partial',function () {
    return gulp.src(app_directory+'/index.html')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('copy-app-partial-css',function () {
    return gulp.src(app_directory+'/app.css')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('copy-app-js',function () {
    return gulp.src(app_directory+'/app.js')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('default',['copy-app-partial','copy-app-partial-css','copy-app-js','copy-partials','copy-js','less-compile'],function() {
    // place code for your default task here
});