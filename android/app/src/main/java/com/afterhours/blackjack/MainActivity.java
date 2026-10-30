package com.afterhours.blackjack;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.webkit.*;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

public class MainActivity extends Activity {
    public WebView web;
    public volatile boolean pageLoaded=false;
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root=new FrameLayout(this); root.setBackgroundColor(Color.rgb(8,21,14));
        if(Build.VERSION.SDK_INT>=30){
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view,insets)->{
                Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                view.setPadding(bars.left,bars.top,bars.right,bars.bottom); return WindowInsets.CONSUMED;
            });
        }
        web=new WebView(this); web.setBackgroundColor(Color.rgb(8,21,14));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        WebSettings settings=web.getSettings();
        settings.setUserAgentString(settings.getUserAgentString()+" BlackjackAndroid");
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets=new WebViewAssetLoader.Builder()
            .addPathHandler("/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(ConsoleMessage message){
                android.util.Log.d("BlackjackWeb",message.messageLevel()+": "+message.message());return true;
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){pageLoaded=false;}
            @Override public void onPageFinished(WebView view,String url){pageLoaded=true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                WebResourceResponse response=assets.shouldInterceptRequest(request.getUrl());
                if(response!=null)return response;
                return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !request.getUrl().toString().startsWith(ORIGIN);}
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
                root.removeView(view);view.destroy();
                TextView retry=new TextView(MainActivity.this);retry.setText("Нажмите, чтобы перезапустить стол");retry.setTextColor(Color.WHITE);retry.setTextSize(20);retry.setPadding(32,48,32,48);
                retry.setOnClickListener(v->recreate());root.addView(retry);return true;
            }
        });
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0,this::handleBack);
        web.loadUrl(ORIGIN+"index.html");
    }
    private void handleBack(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();document.querySelector('#menu-open')?.focus();return true;}const bet=document.querySelector('#bet-toggle');if(bet?.getAttribute('aria-expanded')==='true'){bet.click();return true;}return false;})()",closed->{if(!"true".equals(closed))finish();});}
    // API 33+ uses OnBackInvokedCallback above; this is the legacy fallback only.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed(){handleBack();}
    @Override protected void onPause(){super.onPause();web.onPause();web.pauseTimers();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
    @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
