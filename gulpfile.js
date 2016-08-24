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

gulp.task('clean', function () {
    return del([
        app_directory+'/static/'
    ]);
});

gulp.task('less-compile',function () {
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
    return gulp.src(app_directory+'/UI/index.html')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('copy-app-partial-css',function () {
    return gulp.src(app_directory+'/UI/app.css')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('copy-app-js',function () {
    return gulp.src(app_directory+'/UI/app.js')
        .pipe(gulp.dest(app_directory+'/static/'));
});

gulp.task('default',['clean','copy-partials','copy-js','copy-app-partial','copy-app-partial-css','copy-app-js','less-compile'],function() {
    // place code for your default task here
});