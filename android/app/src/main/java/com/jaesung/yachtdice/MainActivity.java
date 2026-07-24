package com.jaesung.yachtdice;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 하단 AdMob 배너 높이만큼 웹뷰를 위로 올려, 배너가 게임 조작부를 가리거나
    // 그 영역의 터치를 가로채지 않게 한다. 플러그인은 웹뷰를 리사이즈하지 않고
    // 위에 겹쳐 그리므로(BannerExecutor: "Add AdViewLayout top of the WebView"),
    // 웹뷰 자체를 줄이는 이 방식이 모든 게임·페이지에 한 번에 적용된다.
    // 표준 배너 높이 = 50dp. 살짝 여유를 둔다.
    private static final int AD_INSET_DP = 52;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final View webView = getBridge().getWebView();
        if (webView == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                ViewGroup.LayoutParams lp = webView.getLayoutParams();
                if (lp instanceof ViewGroup.MarginLayoutParams) {
                    int px = Math.round(AD_INSET_DP * getResources().getDisplayMetrics().density);
                    ((ViewGroup.MarginLayoutParams) lp).bottomMargin = px;
                    webView.setLayoutParams(lp);
                }
            }
        });
    }
}
