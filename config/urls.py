from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path
from dashboard import views

urlpatterns = [path('', views.home), path('login/', auth_views.LoginView.as_view()), path('logout/', auth_views.LogoutView.as_view()), path('signup/', views.signup), path('admin/', admin.site.urls), path('api/<path:resource>/', views.api), path('photos/<int:pk>/', views.photo), path('sw.js', views.service_worker)]
