---
title: 【数论】gcd、exgcd、质数筛法、逆元与同余方程组复习（已废弃）
mathjax: true
tags:
  - gcd
  - exgcd
  - 逆元
  - 同余方程组
  - 中国剩余定理
  - 卢卡斯定理
  - Lucas
  - OI
categories:
  - 技术
  - OI学习笔记
  - 数论
abbrlink: c22a7f0c
pubDate: 2023-07-04 00:00:00
description: gcd、exgcd、质数筛法、逆元与同余方程组数论复习笔记（已废弃）
---

## 前言

这是我面对自己稀烂不堪的数论后奋笔疾书写出来的一篇复习笔记。算是对我前几个月学习**过**的初等数论的一次总结整理，一个下午的时间可能不够全面，望各位大佬海涵。

## 最大公约数

这里我们使用`欧几里得算法`（也称为辗转相除法）来计算最大公约数——简称“gcd”。因为是复习笔记，这里就不详细讲解原理了，记住公式即可。

算法流程： $gcd( m , n ) = gcd( n , m \% n)$

那么直到最后变成$gcd(m , 0)=m$,m 最后的取值也就是 m 和 n 的最大公约数。

> 用于计算 gcd(m,n)的过程：
>
> 1.  如果 n=0，返回值 m 则作为结果。通过计算过程结束，否则进入第二步。
> 2.  第二步：m 除以 n，将余数赋值给 r；
> 3.  第三步：将 n 的值赋给 m，将 r 的值赋值给 n。返回第一步

我们通过三元运算符`?:`很容易写出函数 gcd：

```cpp
int gcd(int m, int n)
{
    return n == 0 ? m : gcd(n, m % n);
    // 翻译如下
    // if(n == 0) return m;
    // return gcd(n, m % n);
}
```

### 例题 P2441

非常水的一道绿题。

> 题目链接：[P2441 角色属性树 - 洛谷](https://www.luogu.com.cn/problem/P2441)

```cpp
#include <iostream>
#include <cstring>
#include <cstdio>
#include <cmath>
#define N 200005

using namespace std;

int fa[N]; // father
int val[N];
int n, k;

int gcd(int m, int n)
{
    return n == 0 ? m : gcd(n, m % n);
}

int dfs(int crd, int w)
{
    int d = -1;
    int v = fa[crd];
    if(!v) return -1;
    if(gcd(w, val[v]) > 1) d = v;
    else d = dfs(v, w);
    return d;
}

int main()
{
    scanf("%d%d", &n, &k);
    for(int i = 1; i <= n; i++) scanf("%d", &val[i]);
    for(int i = 1; i < n; i++)
    {
        int u, v;
        scanf("%d%d", &u, &v);
        fa[v] = u;
    }
    for(int i = 1; i <= k; i++)
    {
        int u, crd;
        scanf("%d%d", &u, &crd);
        if(u == 1) printf("%d\n", dfs(crd, val[crd]));
        else
        {
            int a;
            scanf("%d", &a);
            val[crd] = a;
        }
    }
    return 0;
}
```

## 扩展欧几里得算法

假设我们现在有一个方程$am + bn = gcd(m, n)$，求 a，b 的解。

### 计算特解

扩展欧几里得算法可以解决这个问题——“简称 exgcd”。我们在 gcd 函数中添加另外两个参数 a 和 b，代表方程中的 a 和 b。

> 算法流程是这样的：
>
> 1.  先按正常方法算出 gcd(m, n)
> 2.  回溯时遵从以下公式
>     从回溯时开始，初始化 a = 1; b= 0;
>     1. a = b;
>     2. b = a - b \* (m / n);
> 3.  最后返回 gcd(m, n)

因为我们计算时 a 与 b 相互引用，加上最后回溯时返回最大公约数，我们定义两个局部变量 c 与 x 当工具人协助我们完成算法。同时为了获取此方程的一个特解，我们把 a 与 b 引用(&)。

代码如下：

```cpp
int exgcd(int m, int n, int& a, int& b) // 回溯时改变a与b的原值
{
    if(n == 0) { a = 1; b = 0; return m; } // n = 0计算结束，回溯开始
    int d = exgcd(n , m % n, a, b); // 工具人d存值
    int c = a; a = b; b = c - b * (m / n); // 工具人c
    return d;
}
```

### 计算通解

这时候我们得到的 a 和 b 只不过是一组特解，我们可以通过 d 写出通解：

$$ \left(a\:+\:\frac{b}{d}k,\:b\:+\:\frac{a}{d}k\right)\:k\epsilon\mathbb{Z} $$

### 扩展情况

假设要求方程$am + bn = g$，求 a，b 的解。

我们可以先按原来的方法，求出$am + bn = gcd(m, n)$的解。

然后把 a，b，gcd(m, n)同时乘上 g / gcd(m, n)就可以了。注意$gcd(m, n) | g$。

## 质数筛法

很蠢的埃式筛我们就不扯了，它浪费时间的地方就是重复筛——比如 15 被 3 和 5 筛了两次。

我们直接拿出欧拉筛，规定每个数字只被它最小的质因数筛去，复杂度降为$O(N)$。

直接上代码：

```cpp
#define N 100005
bool not_prime[N];
int prime[N], tot;
for(int i = 2; i <= N; i++)
{
    if(!not_prime[i]) primt[++tot] = i;
    for(int j = 1; j <= n && i * prime[j] <= N; j++)
    {
        not_prime[i * prime[j]] = true;
        if(i % prime[j] == 0) break;
    }
}
```

## 逆元

逆元是一个很神奇的东西，你可以理解成广义上的倒数。

什么是倒数？任意一个数乘上一个倒数，结果为 1，相当于除了它自己。那么举个例子，有些题目要求你对答案取模，众所周知乘法加法一边运算一边取模是不会影响正确性的，但是要是来个除，你就不得不把它计算完全之后再取模——有可能爆 long long。

那么逆元就出现了！逆元就是一个数在一个取模环境下的倒数，乘上它就等于除以原来的数字，就与加法乘法一样了。我们这样定义逆元：

假设 a，b 满足以下条件（模 m 意义下的等价类集合）

$$ a,b\epsilon\mathbb{Z}\_m $$

同时满足$ab\:\equiv\:1\:(\mod\:m)$，我们就说 b 是 a 的逆元，或者 a 是 b 的逆元。是不是很简单？

> 逆元可不只有一个哦！

### 求解逆元

求解逆元有很多方法，这里我们就只联系上下文，讲一下如何通过 exgcd 求解逆元。

我们简单想一想，假设我们要求 a 的逆元 b，如果$ab \mod m = 1$，是不是说明$ab - mk = 1$呢？而这里我们的`a`和`m`是已知的，我去，这不就是$am + bn = g$的形式吗！你说一个减一个加？这有什么关系？不就相当于$am + (-k)m = 1$吗？其实是没有区别的。

那就轻轻松松了，结合我们之前 exgcd 的铺垫，我们直接使用`exgcd(a, m, b, k)`运行完毕之后`b/d`就是 a 的一个逆元了。~~当然如果`b/d`除不尽那就寄啦~~。

但是我说了，逆元并不只有一个，要是题目要求是最小正整数的逆元怎么办？

直接上公式：`a的逆元 = (b % m + m) % m;`至于为什么，请读者自行证明吧（毕竟是复习笔记）。

### 卢卡斯定理/Lucas 定理

假设有一道题目让你求${C}_{n+m}^{n}\mod p$的值，你会怎么求？

也许你会不屑一顾——我逆元在手，不轻轻松松？

但是你忘记了一件事……如果有一部分刚好是 p 的倍数，那不就寄啦？

呵呵，这时候就要请出我们的 Lucas 定理了，专门来解决这种组合数取模的题目。

#### 实现

假设 A、B 是非负整数，p 是质数。AB 写成 p 进制：$A=a[n]a[n-1]...a[0]$，$B=b[n]b[n-1]...b[0]$。则组合数$C(A,B)$与$C(a[n],b[n])*C(a[n-1],b[n-1])..C(a[0],b[0]) \mod p$同余。即：

$Lucas(n,m,p)=C(n\%p,m\%p)*Lucas(n/p,m/p,p)$

简言之，Lucas 定理是用来求 $C(n,m) \mod p$，p 为素数的值。

#### 例题 P3807

> 题目链接：[P3807 【模板】卢卡斯定理/Lucas 定理](https://www.luogu.com.cn/problem/solution/P3807)

```cpp
#include<iostream>
#include<algorithm>
#include<cstdio>
#define N 100005

using namespace std;

int t, p;
int n, m;
long long a[N], b[N];

long long lucas(int x,int y)
{
  if(x < y) return 0;
  else if(x < p) return b[x] * a[y] * a[x - y] % p;
  else return lucas(x / p, y / p) * lucas(x % p,y % p) % p;
}

int main()
{
  scanf("%d", &t);
  while(t--)
  {
    scanf("%d%d%d", &n, &m, &p);
    a[0] = a[1] = b[0] = b[1] = 1;
    for(int i = 2; i <= n + m; i++) b[i] = b[i - 1] * i % p; // 处理成p进制
    for(int i = 2; i <= n + m; i++) a[i] = (p - p / i) * a[p % i] % p;
    for(int i = 2; i <= n + m; i++) a[i] = a[i - 1] * a[i] % p;
    printf("%lld\n", lucas(n + m, m));
  }
  return 0;
}
```

## 同余方程组

几个$a\:\equiv\:b\:(\mod\:m)$叠在一起就变成了同余方程组。

例如下面的同余方程组：

$$ \begin{cases}{a\:\equiv\:b_1\:(\mod\:m_1)} \\ {a\:\equiv\:b_2\:(\mod\:m_2)} \\ {a\:\equiv\:b_3\:(\mod\:m_3)}\end{cases} $$

我承认这是一个很吓人的东西，但是推导也不难。

虽然可以用中国剩余定理做，但是可惜它只能解决模数互质的情况。

那么我们可以换一种思路，合并同余方程组。

> ~~可惜过程我忘光了呜呜呜，老师救我数论~~
> 有时间再补上推理吧——2023/07/05

直接上代码：

> 注意暴力计算会超 long long，这里我用了龟速幂等方法成功把其压在了 long long 内。嫌弃麻烦的同学可以直接使用\_\_int128 或者高精度，这里不再赘述。~~我故意保留了一部分注释，让你知道这是我打的~~

```cpp
#include <iostream>
#include <cmath>
#define ll long long

using namespace std;

ll Exgcd(ll a, ll b, ll &x, ll &y)
{
    if (b == 0)
    {
        x = 1, y = 0;
        return a;
    }
    ll d = Exgcd(b, a % b, x, y);
    ll z = x; x = y; y = z - (a / b) * y;

    return d;
}

ll qmul(ll a, ll b, ll p)
{
    a %= p;
    b = (b % p + p) % p;
    ll res = 0;
    while (b)
    {
        if (b & 1) { res = (res + a) % p; }
        a = (a + a) % p;
        b >>= 1;
    }
    return res;
}

int main()
{
    ll a1, a2;
    ll b1, b2;
    ll n = 0;
    //freopen("1.txt","r",stdin);
    scanf("%lld", &n);
    scanf("%lld%lld", &a1, &b1);
    //printf("1:\nX = %lld (mod %lld)\n", b1, a1);
    for(ll i = 2; i <= n; i++)
    {
        scanf("%lld%lld", &a2, &b2);
        //printf("2:\nX = %lld (mod %lld)\n", b2, a2);
        ll y1 = 0, y2 = 0;
        //a1 * y1 - a2 * y2 = b2 - b1
        //y1 y2 dont know
        ll d = Exgcd(a1, a2, y1, y2);

        ll cnt = a2 / d;
        //y1 = y1 / d;
        //y1 = (y1 % cnt + cnt) % cnt;
        //y1 = (y1 = y1 / d * (b2 - b1) % cnt + cnt) % cnt;
        //y1 = (qmul(b2 - b1, y1, cnt) + cnt) % cnt;
        y1 = (qmul(y1, ((b2 - b1) / d % a2 + a2) % a2, cnt) + cnt) % cnt;

        b1 = y1 * a1 + b1;
        a1 = (a1 * cnt);
        b1 = (b1 % a1 + a1) % a1;
        //printf("AND:\nX = %lld (mod %lld)\n", b1, a1);
    }

    //printf("X = %lld k + %lld \n", a1, b1);

    ll ans = (b1 % a1 + a1) % a1;
    printf("%lld", ans);

    return 0;
}
```
